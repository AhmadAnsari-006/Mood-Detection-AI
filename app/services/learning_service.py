import os
from datetime import datetime, timedelta
from services import db_service

VALID_EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral", "love", "happy", "sad"]

def build_verified_dataset():
    """Reads verified predictions and approved corrections, merges them, removes duplicates, and generates verified_dataset.json."""
    predictions = db_service.read_db("predictions")
    corrections = db_service.read_db("corrections")

    merged_data = {}

    # 1. Process verified predictions (verified = True)
    for p in predictions:
        if p.get("verified") is True:
            sentence = p.get("sentence", "").strip()
            emotion = p.get("predictedEmotion", "").strip().lower()
            
            # Simple clean/normalize check
            if sentence and emotion:
                # Store by sentence to easily remove/overwrite duplicates
                merged_data[sentence] = {
                    "sentence": sentence,
                    "emotion": emotion,
                    "source": "prediction",
                    "timestamp": p.get("timestamp")
                }

    # 2. Process approved corrections (status = "approved")
    for c in corrections:
        if c.get("status") == "approved":
            sentence = c.get("sentence", "").strip()
            emotion = c.get("correctEmotion", "").strip().lower()
            
            if sentence and emotion:
                # Corrections overwrite predictions (corrections are developer-approved ground truth)
                merged_data[sentence] = {
                    "sentence": sentence,
                    "emotion": emotion,
                    "source": "correction",
                    "timestamp": c.get("timestamp")
                }

    # 3. Validate entries and convert to a list
    final_list = []
    for sentence, item in merged_data.items():
        # Validate emotion is in valid classes (or support custom ones if needed, but standardize)
        emotion = item["emotion"]
        # Standardize matching titles for known emotions
        standard_map = {
            "happy": "joy",
            "sad": "sadness",
            "love": "joy" # or map as is. We can keep it or map to standard categories
        }
        if emotion in standard_map:
            emotion = standard_map[emotion]
            
        final_list.append({
            "sentence": item["sentence"],
            "emotion": emotion.capitalize(),
            "source": item["source"],
            "timestamp": item["timestamp"]
        })

    # Save to verified_dataset.json
    db_service.write_db("verified_dataset", final_list)
    return len(final_list)

def get_learning_analytics():
    """Generates analytics report and data charts for the Developer Dashboard."""
    predictions = db_service.read_db("predictions")
    corrections = db_service.read_db("corrections")
    verified_dataset = db_service.read_db("verified_dataset")
    users = db_service.read_db("users")
    sessions = db_service.read_db("sessions")

    total_preds = len(predictions)
    total_corrs = len(corrections)
    
    # Calculate counts of verified/unverified predictions
    correct_count = sum(1 for p in predictions if p.get("verified") is True)
    incorrect_count = sum(1 for p in predictions if p.get("verified") is False)
    unlabeled_count = sum(1 for p in predictions if p.get("verified") is None)
    
    # Compute accuracy percentage
    # Accuracy = Correct Predictions / (Correct + Incorrect) * 100
    # If no feedback, we can fall back to a baseline or total reviewed.
    reviewed_preds = correct_count + incorrect_count
    accuracy = 100.0 if reviewed_preds == 0 else (correct_count / reviewed_preds) * 100.0

    # User activity stats
    user_stats = {}
    for u in users:
        username = u["username"]
        user_stats[username] = {
            "username": username,
            "role": u["role"],
            "predictions_count": 0,
            "corrections_count": 0,
            "last_activity": "Never",
            "session_status": "Offline"
        }
        
    # Check sessions
    active_users = set()
    for s_token, sess in sessions.items():
        uname = sess.get("username")
        if uname in user_stats:
            user_stats[uname]["session_status"] = "Active"
            active_users.add(uname)

    # Accumulate user interaction counts
    for p in predictions:
        uname = p.get("username")
        if uname in user_stats:
            user_stats[uname]["predictions_count"] += 1
            if p.get("timestamp"):
                user_stats[uname]["last_activity"] = p["timestamp"]
                
    for c in corrections:
        uname = c.get("username")
        if uname in user_stats:
            user_stats[uname]["corrections_count"] += 1
            if c.get("timestamp"):
                # If prediction timestamp is older than correction, update last_activity
                if user_stats[uname]["last_activity"] == "Never" or c["timestamp"] > user_stats[uname]["last_activity"]:
                    user_stats[uname]["last_activity"] = c["timestamp"]

    # Trend calculations (Daily vs Weekly accuracy)
    # Group by date
    now = datetime.now()
    daily_stats = {}
    weekly_stats = {"correct": 0, "total": 0}
    
    for p in predictions:
        if not p.get("timestamp"):
            continue
        try:
            p_date = datetime.fromisoformat(p["timestamp"])
        except ValueError:
            continue
            
        date_str = p_date.strftime("%Y-%m-%d")
        
        if date_str not in daily_stats:
            daily_stats[date_str] = {"correct": 0, "total": 0}
            
        if p.get("verified") is True:
            daily_stats[date_str]["correct"] += 1
            daily_stats[date_str]["total"] += 1
            if now - p_date <= timedelta(days=7):
                weekly_stats["correct"] += 1
                weekly_stats["total"] += 1
        elif p.get("verified") is False:
            daily_stats[date_str]["total"] += 1
            if now - p_date <= timedelta(days=7):
                weekly_stats["total"] += 1

    # Format daily accuracy trend
    sorted_dates = sorted(daily_stats.keys())[-7:]  # Last 7 active days
    daily_trend = []
    for d in sorted_dates:
        corr = daily_stats[d]["correct"]
        tot = daily_stats[d]["total"]
        acc = (corr / tot * 100.0) if tot > 0 else 100.0
        daily_trend.append({"date": d, "accuracy": round(acc, 2), "total": tot})

    weekly_accuracy = (weekly_stats["correct"] / weekly_stats["total"] * 100.0) if weekly_stats["total"] > 0 else 100.0

    # Learning Engine Analysis: Mismatched Emotions / Mismatch rates
    mismatches = {}
    for c in corrections:
        pred_em = c.get("predictedEmotion", "unknown").capitalize()
        corr_em = c.get("correctEmotion", "unknown").capitalize()
        key = f"{pred_em} -> {corr_em}"
        mismatches[key] = mismatches.get(key, 0) + 1

    # Most corrected emotions (which emotions were predicted that users corrected most often)
    corrected_emotions = {}
    for c in corrections:
        pred_em = c.get("predictedEmotion", "unknown").capitalize()
        corrected_emotions[pred_em] = corrected_emotions.get(pred_em, 0) + 1

    # Distribution of emotions in predictions
    emotion_dist = {}
    for p in predictions:
        em = p.get("predictedEmotion", "unknown").capitalize()
        emotion_dist[em] = emotion_dist.get(em, 0) + 1

    return {
        "overview": {
            "total_users": len(users),
            "active_users": len(active_users),
            "total_predictions": total_preds,
            "total_corrections": total_corrs,
            "accuracy_percentage": round(accuracy, 2),
            "dataset_size": len(verified_dataset)
        },
        "trends": {
            "daily_accuracy": daily_trend,
            "weekly_accuracy": round(weekly_accuracy, 2),
            "overall_accuracy": round(accuracy, 2)
        },
        "user_activity": list(user_stats.values()),
        "mismatches": [{"pair": k, "count": v} for k, v in mismatches.items()],
        "most_corrected": [{"emotion": k, "count": v} for k, v in corrected_emotions.items()],
        "emotion_distribution": [{"emotion": k, "count": v} for k, v in emotion_dist.items()]
    }
