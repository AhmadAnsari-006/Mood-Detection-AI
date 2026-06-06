import sys
import os

# Add parent directory and src directory to python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_root)
sys.path.append(os.path.join(project_root, "src"))

from flask import Flask, render_template, request, jsonify
import predict

sys.path.append(os.path.join(project_root, "app"))
from services import db_service, auth_service

# Initialize database folders & seed standard users
db_service.init_db()

app = Flask(__name__)

# Register Blueprints for Auth, Developer Features, and Feedback
from routes_auth import auth_bp
from routes_dev import dev_bp
from routes_feedback import feedback_bp

app.register_blueprint(auth_bp)
app.register_blueprint(dev_bp)
app.register_blueprint(feedback_bp)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/developer")
def developer_portal():
    return render_template("developer.html")

@app.route("/predict", methods=["POST"])
def predict_route():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data["text"].strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        # Predict mood with confidence
        mood, confidence = predict.predict_mood_with_confidence(text)
        
        # Check if the session is active (user is logged in)
        user = auth_service.get_current_user()
        if user:
            import uuid
            from datetime import datetime
            prediction_id = str(uuid.uuid4())
            timestamp = datetime.now().isoformat()
            
            # Store prediction in predictions.json for feedback/learning
            predictions = db_service.read_db("predictions")
            new_pred = {
                "id": prediction_id,
                "userId": user["userId"],
                "username": user["username"],
                "sentence": text,
                "predictedEmotion": mood,
                "confidence": round(confidence, 4),
                "timestamp": timestamp,
                "verified": None
            }
            predictions.append(new_pred)
            db_service.write_db("predictions", predictions)
            
            return jsonify({
                "id": prediction_id,
                "mood": mood,
                "confidence": round(confidence * 100, 1)
            })
        else:
            # Anonymous prediction
            return jsonify({
                "mood": mood,
                "confidence": round(confidence * 100, 1)
            })
            
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)