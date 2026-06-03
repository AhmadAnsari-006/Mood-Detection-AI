from flask import Blueprint, request, jsonify, g, send_file
import sys
import os
import io
import json
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services import auth_service, db_service, learning_service

dev_bp = Blueprint("dev_bp", __name__)

@dev_bp.route("/api/dev/metrics", methods=["GET"])
@auth_service.developer_required
def get_metrics():
    analytics = learning_service.get_learning_analytics()
    return jsonify(analytics["overview"])

@dev_bp.route("/api/dev/analytics", methods=["GET"])
@auth_service.developer_required
def get_analytics():
    analytics = learning_service.get_learning_analytics()
    return jsonify(analytics)

@dev_bp.route("/api/dev/corrections/queue", methods=["GET"])
@auth_service.developer_required
def get_corrections_queue():
    corrections = db_service.read_db("corrections")
    # Return only pending ones
    pending = [c for c in corrections if c.get("status") == "pending"]
    return jsonify(pending)

@dev_bp.route("/api/dev/corrections/review", methods=["POST"])
@auth_service.developer_required
def review_correction():
    data = request.get_json() or {}
    correction_id = data.get("correctionId")
    action = data.get("action")  # "approve" or "reject"
    edited_emotion = data.get("correctEmotion")  # optional edited value

    if not correction_id or action not in ["approve", "reject"]:
        return jsonify({"error": "Missing correctionId or invalid action"}), 400

    corrections = db_service.read_db("corrections")
    corr_idx = -1
    for i, c in enumerate(corrections):
        if c["id"] == correction_id:
            corr_idx = i
            break

    if corr_idx == -1:
        return jsonify({"error": "Correction record not found"}), 404

    target = corrections[corr_idx]
    dev_user = g.current_user["username"]

    if action == "approve":
        corrections[corr_idx]["status"] = "approved"
        if edited_emotion:
            corrections[corr_idx]["correctEmotion"] = edited_emotion.strip().capitalize()
        
        # Log action
        db_service.log_activity(
            dev_user, 
            "approve_correction", 
            {"id": correction_id, "sentence": target["sentence"], "emotion": corrections[corr_idx]["correctEmotion"]}
        )
    else:
        corrections[corr_idx]["status"] = "rejected"
        db_service.log_activity(
            dev_user, 
            "reject_correction", 
            {"id": correction_id, "sentence": target["sentence"]}
        )

    db_service.write_db("corrections", corrections)
    
    # Auto rebuild dataset to keep in sync
    learning_service.build_verified_dataset()

    return jsonify({"success": True, "message": f"Correction {action}d successfully"})

# ================= DATASET MANAGER CRUD =================

@dev_bp.route("/api/dev/dataset", methods=["GET"])
@auth_service.developer_required
def get_dataset():
    dataset = db_service.read_db("verified_dataset")
    return jsonify(dataset)

@dev_bp.route("/api/dev/dataset/edit", methods=["POST"])
@auth_service.developer_required
def edit_dataset_record():
    data = request.get_json() or {}
    sentence = data.get("sentence")
    new_emotion = data.get("emotion")

    if not sentence or not new_emotion:
        return jsonify({"error": "Sentence and emotion are required"}), 400

    dataset = db_service.read_db("verified_dataset")
    found = False
    for i, item in enumerate(dataset):
        if item["sentence"] == sentence:
            db_service.log_activity(
                g.current_user["username"], 
                "edit_dataset_record", 
                {"sentence": sentence, "old_emotion": item["emotion"], "new_emotion": new_emotion}
            )
            dataset[i]["emotion"] = new_emotion.strip().capitalize()
            found = True
            break

    if not found:
        return jsonify({"error": "Dataset record not found"}), 404

    db_service.write_db("verified_dataset", dataset)
    return jsonify({"success": True, "message": "Dataset record updated"})

@dev_bp.route("/api/dev/dataset/delete", methods=["POST"])
@auth_service.developer_required
def delete_dataset_record():
    data = request.get_json() or {}
    sentence = data.get("sentence")

    if not sentence:
        return jsonify({"error": "Sentence is required"}), 400

    dataset = db_service.read_db("verified_dataset")
    new_dataset = [item for item in dataset if item["sentence"] != sentence]

    if len(new_dataset) == len(dataset):
        return jsonify({"error": "Dataset record not found"}), 404

    db_service.log_activity(
        g.current_user["username"], 
        "delete_dataset_record", 
        {"sentence": sentence}
    )

    db_service.write_db("verified_dataset", new_dataset)
    return jsonify({"success": True, "message": "Dataset record deleted"})

@dev_bp.route("/api/dev/dataset/export", methods=["GET"])
@auth_service.developer_required
def export_dataset():
    dataset = db_service.read_db("verified_dataset")
    
    # Generate JSON file in-memory
    mem_file = io.BytesIO()
    mem_file.write(json.dumps(dataset, indent=4).encode('utf-8'))
    mem_file.seek(0)
    
    db_service.log_activity(g.current_user["username"], "export_dataset", {"records_count": len(dataset)})
    
    return send_file(
        mem_file,
        mimetype="application/json",
        as_attachment=True,
        download_name="verified_dataset.json"
    )

@dev_bp.route("/api/dev/dataset/import", methods=["POST"])
@auth_service.developer_required
def import_dataset():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    try:
        content = file.read().decode('utf-8')
        imported_data = json.loads(content)
        
        if not isinstance(imported_data, list):
            return jsonify({"error": "Dataset must be a JSON array of records"}), 400
            
        # Security & Integrity check: validate imported entries
        valid_records = []
        for idx, entry in enumerate(imported_data):
            sentence = entry.get("sentence", "").strip()
            emotion = entry.get("emotion", "").strip()
            
            if not sentence or not emotion:
                return jsonify({"error": f"Invalid entry at index {idx}: sentence and emotion are required"}), 400
                
            valid_records.append({
                "sentence": sentence,
                "emotion": emotion.capitalize(),
                "source": entry.get("source", "import"),
                "timestamp": entry.get("timestamp", datetime.now().isoformat())
            })

        # Save backup before modifying
        db_service.create_backup(g.current_user["username"])

        # Merge and remove duplicates (prioritize imported records)
        existing_dataset = db_service.read_db("verified_dataset")
        merged = {item["sentence"]: item for item in existing_dataset}
        
        for rec in valid_records:
            merged[rec["sentence"]] = rec
            
        final_list = list(merged.values())
        db_service.write_db("verified_dataset", final_list)

        db_service.log_activity(
            g.current_user["username"], 
            "import_dataset", 
            {"imported_count": len(valid_records), "final_count": len(final_list)}
        )

        return jsonify({"success": True, "message": f"Successfully imported {len(valid_records)} records"})
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ================= USER STATEMENTS MANAGER =================

@dev_bp.route("/api/dev/statements", methods=["GET"])
@auth_service.developer_required
def get_statements():
    predictions = db_service.read_db("predictions")
    corrections = db_service.read_db("corrections")
    
    # Map corrections by predictionId for easy lookup
    corr_map = {c["predictionId"]: c for c in corrections}
    
    statements = []
    for p in predictions:
        p_id = p["id"]
        corr = corr_map.get(p_id)
        
        status = "Unreviewed"
        if p.get("verified") is True:
            status = "Verified"
        elif p.get("verified") is False:
            if corr:
                status = f"Corrected ({corr.get('status').capitalize()})"
            else:
                status = "Corrected"

        statements.append({
            "id": p_id,
            "sentence": p["sentence"],
            "predictedEmotion": p["predictedEmotion"],
            "correctEmotion": corr["correctEmotion"] if corr else "-",
            "username": p.get("username", "anonymous"),
            "timestamp": p.get("timestamp"),
            "verified": p.get("verified"),
            "status": status
        })
        
    return jsonify(statements)

@dev_bp.route("/api/dev/statements/edit", methods=["POST"])
@auth_service.developer_required
def edit_statement():
    data = request.get_json() or {}
    pred_id = data.get("id")
    new_sentence = data.get("sentence")
    new_pred_emotion = data.get("predictedEmotion")

    if not pred_id or not new_sentence or not new_pred_emotion:
        return jsonify({"error": "ID, sentence, and predictedEmotion are required"}), 400

    predictions = db_service.read_db("predictions")
    found = False
    
    for i, p in enumerate(predictions):
        if p["id"] == pred_id:
            db_service.log_activity(
                g.current_user["username"],
                "edit_statement",
                {"id": pred_id, "old_sentence": p["sentence"], "new_sentence": new_sentence}
            )
            predictions[i]["sentence"] = new_sentence
            predictions[i]["predictedEmotion"] = new_pred_emotion.strip().capitalize()
            found = True
            break
            
    if not found:
        return jsonify({"error": "Statement record not found"}), 404
        
    db_service.write_db("predictions", predictions)
    
    # If there is an associated correction, update its sentence too
    corrections = db_service.read_db("corrections")
    for i, c in enumerate(corrections):
        if c["predictionId"] == pred_id:
            corrections[i]["sentence"] = new_sentence
            db_service.write_db("corrections", corrections)
            break
            
    learning_service.build_verified_dataset()
    return jsonify({"success": True, "message": "Statement updated successfully"})

@dev_bp.route("/api/dev/statements/delete", methods=["POST"])
@auth_service.developer_required
def delete_statement():
    data = request.get_json() or {}
    pred_id = data.get("id")

    if not pred_id:
        return jsonify({"error": "ID is required"}), 400

    predictions = db_service.read_db("predictions")
    new_predictions = [p for p in predictions if p["id"] != pred_id]

    if len(new_predictions) == len(predictions):
        return jsonify({"error": "Statement record not found"}), 404

    db_service.log_activity(g.current_user["username"], "delete_statement", {"id": pred_id})
    db_service.write_db("predictions", new_predictions)

    # Delete corresponding corrections if they exist
    corrections = db_service.read_db("corrections")
    new_corrections = [c for c in corrections if c["predictionId"] != pred_id]
    if len(new_corrections) < len(corrections):
        db_service.write_db("corrections", new_corrections)

    learning_service.build_verified_dataset()
    return jsonify({"success": True, "message": "Statement and associated feedback deleted"})

@dev_bp.route("/api/dev/statements/export", methods=["GET"])
@auth_service.developer_required
def export_statements():
    predictions = db_service.read_db("predictions")
    
    mem_file = io.BytesIO()
    mem_file.write(json.dumps(predictions, indent=4).encode('utf-8'))
    mem_file.seek(0)
    
    db_service.log_activity(g.current_user["username"], "export_statements", {"records_count": len(predictions)})
    
    return send_file(
        mem_file,
        mimetype="application/json",
        as_attachment=True,
        download_name="user_statements.json"
    )

# ================= SYSTEM BACKUPS & AUDIT LOGS =================

@dev_bp.route("/api/dev/backups", methods=["GET"])
@auth_service.developer_required
def get_backups():
    backups = []
    backups_dir = db_service.BACKUPS_DIR
    if os.path.exists(backups_dir):
        for name in os.listdir(backups_dir):
            path = os.path.join(backups_dir, name)
            if os.path.isdir(path):
                # Count files inside
                file_count = len(os.listdir(path))
                created = datetime.fromtimestamp(os.path.getctime(path)).isoformat()
                backups.append({
                    "name": name,
                    "created": created,
                    "files": file_count
                })
    return jsonify(sorted(backups, key=lambda x: x["name"], reverse=True))

@dev_bp.route("/api/dev/backup/create", methods=["POST"])
@auth_service.developer_required
def trigger_backup():
    try:
        backup_name = db_service.create_backup(g.current_user["username"])
        return jsonify({"success": True, "message": f"Backup created successfully: {backup_name}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dev_bp.route("/api/dev/logs", methods=["GET"])
@auth_service.developer_required
def get_logs():
    logs = db_service.read_db("activity_logs")
    return jsonify(logs)

@dev_bp.route("/api/dev/engine/run", methods=["POST"])
@auth_service.developer_required
def run_dataset_builder():
    dev_user = g.current_user["username"]
    db_service.log_activity(dev_user, "run_verified_dataset_builder", {"message": "Manual trigger of verified dataset compiler"})
    dataset_size = learning_service.build_verified_dataset()
    return jsonify({"success": True, "message": f"Dataset rebuilt successfully. Dataset size: {dataset_size} entries."})
