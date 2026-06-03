from flask import Blueprint, request, jsonify, g
import sys
import os
import uuid
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services import auth_service, db_service
import predict

feedback_bp = Blueprint("feedback_bp", __name__)

@feedback_bp.route("/predict", methods=["POST"])
@auth_service.login_required
def predict_route():
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    user = g.current_user

    try:
        # We will extend predict.py to support confidence extraction
        # If it doesn't support it yet, we'll implement fallback locally in predict.py or here
        if hasattr(predict, "predict_mood_with_confidence"):
            mood, confidence = predict.predict_mood_with_confidence(text)
        else:
            # Inline fallback if predict.py not modified yet
            mood = predict.predict_mood(text)
            confidence = 0.85

        # 1. Generate prediction ID
        prediction_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()

        # 2. Store prediction in predictions.json
        predictions = db_service.read_db("predictions")
        new_pred = {
            "id": prediction_id,
            "userId": user["userId"],
            "username": user["username"],
            "sentence": text,
            "predictedEmotion": mood,
            "confidence": round(confidence, 4),
            "timestamp": timestamp,
            "verified": None  # Will be set to True/False once user answers
        }
        predictions.append(new_pred)
        db_service.write_db("predictions", predictions)

        # 3. Return results
        return jsonify({
            "id": prediction_id,
            "mood": mood,
            "confidence": round(confidence * 100, 1)
        })

    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@feedback_bp.route("/api/feedback/submit", methods=["POST"])
@auth_service.login_required
def submit_feedback():
    data = request.get_json() or {}
    prediction_id = data.get("predictionId")
    correct = data.get("correct")  # Boolean
    correct_emotion = data.get("correctEmotion")  # String (only for incorrect)

    if not prediction_id or correct is None:
        return jsonify({"error": "Missing predictionId or correct flag"}), 400

    user = g.current_user

    # 1. Fetch predictions
    predictions = db_service.read_db("predictions")
    pred_idx = -1
    for i, p in enumerate(predictions):
        if p["id"] == prediction_id:
            pred_idx = i
            break

    if pred_idx == -1:
        return jsonify({"error": "Prediction record not found"}), 404

    prediction = predictions[pred_idx]

    # Security check: prevent duplicate feedback spam
    if prediction["verified"] is not None:
        return jsonify({"error": "Feedback has already been submitted for this prediction"}), 400

    timestamp = datetime.now().isoformat()

    if correct:
        # Update prediction record
        predictions[pred_idx]["verified"] = True
        db_service.write_db("predictions", predictions)
    else:
        if not correct_emotion:
            return jsonify({"error": "Correct emotion is required for incorrect predictions"}), 400
            
        # Standardize format
        correct_emotion = correct_emotion.strip().capitalize()

        # Update prediction record
        predictions[pred_idx]["verified"] = False
        db_service.write_db("predictions", predictions)

        # Log correction record
        corrections = db_service.read_db("corrections")
        new_corr = {
            "id": str(uuid.uuid4()),
            "predictionId": prediction_id,
            "userId": user["userId"],
            "username": user["username"],
            "sentence": prediction["sentence"],
            "predictedEmotion": prediction["predictedEmotion"],
            "correctEmotion": correct_emotion,
            "confidence": prediction["confidence"],
            "timestamp": timestamp,
            "status": "pending"  # Needs dev approval to go into verified_dataset.json
        }
        corrections.append(new_corr)
        db_service.write_db("corrections", corrections)

    return jsonify({"success": True, "message": "Feedback submitted successfully"})
