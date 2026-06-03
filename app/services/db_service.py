import os
import json
import uuid
import shutil
import threading
from datetime import datetime

# Thread locks for each data file to prevent concurrent write corruption
_locks = {
    "users": threading.Lock(),
    "sessions": threading.Lock(),
    "predictions": threading.Lock(),
    "corrections": threading.Lock(),
    "verified_dataset": threading.Lock(),
    "activity_logs": threading.Lock(),
}

# Resolve project paths relative to this file
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(SERVICES_DIR)
PROJECT_ROOT = os.path.dirname(APP_DIR)

DATABASE_DIR = os.path.join(PROJECT_ROOT, "database")
LEARNING_DIR = os.path.join(PROJECT_ROOT, "learning_data")
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
BACKUPS_DIR = os.path.join(MODELS_DIR, "backups")

# Helper to hash passwords using SHA-256 natively
import hashlib
def hash_password(password, salt="moodai_salt_123"):
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def init_db():
    """Initializes the database folders and JSON files if they don't exist, and forces a reset on next start if .reset_complete_v2 file does not exist."""
    os.makedirs(DATABASE_DIR, exist_ok=True)
    os.makedirs(LEARNING_DIR, exist_ok=True)
    os.makedirs(BACKUPS_DIR, exist_ok=True)

    # Helper to check/create file with default content
    def ensure_file(filepath, default_content, lock_key):
        if not os.path.exists(filepath):
            with _locks[lock_key]:
                with open(filepath, 'w') as f:
                    json.dump(default_content, f, indent=4)

    reset_marker = os.path.join(DATABASE_DIR, ".reset_complete_v2")
    if not os.path.exists(reset_marker):
        # Force purge/reinitialize all databases to wipe history
        print("[DATABASE] Running data purge & migration reset...")
        
        # 1. Clear out predictions, corrections, verified dataset, logs, and sessions
        with _locks["predictions"]:
            with open(os.path.join(LEARNING_DIR, "predictions.json"), 'w') as f:
                json.dump([], f, indent=4)
        with _locks["corrections"]:
            with open(os.path.join(LEARNING_DIR, "corrections.json"), 'w') as f:
                json.dump([], f, indent=4)
        with _locks["verified_dataset"]:
            with open(os.path.join(LEARNING_DIR, "verified_dataset.json"), 'w') as f:
                json.dump([], f, indent=4)
        with _locks["activity_logs"]:
            with open(os.path.join(LEARNING_DIR, "activity_logs.json"), 'w') as f:
                json.dump([], f, indent=4)
        with _locks["sessions"]:
            with open(os.path.join(DATABASE_DIR, "sessions.json"), 'w') as f:
                json.dump({}, f, indent=4)

        # 2. Reset Users to exactly admin developer and meta meta-user
        users = [
            {
                "id": str(uuid.uuid4()),
                "username": "admin",
                "email": "admin@moodai.dev",
                "password": hash_password("adminpassword"),
                "fullName": "Admin Developer",
                "role": "developer"
            },
            {
                "id": str(uuid.uuid4()),
                "username": "meta",
                "email": "meta@moodai.dev",
                "password": hash_password("metapassword"),
                "fullName": "Meta-User Account",
                "role": "meta-user"
            }
        ]
        with _locks["users"]:
            with open(os.path.join(DATABASE_DIR, "users.json"), 'w') as f:
                json.dump(users, f, indent=4)

        # Create marker file
        with open(reset_marker, 'w') as f:
            f.write("Migration complete.")
    else:
        # Standard safety check if files deleted but reset marker was there
        ensure_file(os.path.join(DATABASE_DIR, "sessions.json"), {}, "sessions")
        ensure_file(os.path.join(LEARNING_DIR, "predictions.json"), [], "predictions")
        ensure_file(os.path.join(LEARNING_DIR, "corrections.json"), [], "corrections")
        ensure_file(os.path.join(LEARNING_DIR, "verified_dataset.json"), [], "verified_dataset")
        ensure_file(os.path.join(LEARNING_DIR, "activity_logs.json"), [], "activity_logs")
        
        users_file = os.path.join(DATABASE_DIR, "users.json")
        if not os.path.exists(users_file):
            users = [
                {
                    "id": str(uuid.uuid4()),
                    "username": "admin",
                    "email": "admin@moodai.dev",
                    "password": hash_password("adminpassword"),
                    "fullName": "Admin Developer",
                    "role": "developer"
                },
                {
                    "id": str(uuid.uuid4()),
                    "username": "meta",
                    "email": "meta@moodai.dev",
                    "password": hash_password("metapassword"),
                    "fullName": "Meta-User Account",
                    "role": "meta-user"
                }
            ]
            ensure_file(users_file, users, "users")


def get_file_path(db_name):
    """Maps a DB name to its absolute file path."""
    if db_name in ["users", "sessions"]:
        return os.path.join(DATABASE_DIR, f"{db_name}.json")
    elif db_name in ["predictions", "corrections", "verified_dataset", "activity_logs"]:
        return os.path.join(LEARNING_DIR, f"{db_name}.json")
    else:
        raise ValueError(f"Unknown database name: {db_name}")

def read_db(db_name):
    """Thread-safe read from a JSON database."""
    filepath = get_file_path(db_name)
    lock = _locks.get(db_name, threading.Lock())
    
    with lock:
        if not os.path.exists(filepath):
            return {} if db_name == "sessions" else []
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading {db_name} database: {e}")
            return {} if db_name == "sessions" else []

def write_db(db_name, data):
    """Thread-safe write to a JSON database."""
    filepath = get_file_path(db_name)
    lock = _locks.get(db_name, threading.Lock())
    
    with lock:
        try:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=4)
            return True
        except Exception as e:
            print(f"Error writing to {db_name} database: {e}")
            return False

def log_activity(username, action, details):
    """Logs developer/system activity for audit logs."""
    logs = read_db("activity_logs")
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "username": username,
        "action": action,
        "details": details
    }
    logs.insert(0, log_entry)  # Prepend for chronological descending view
    write_db("activity_logs", logs)

def create_backup(username="system"):
    """Creates a timestamped backup of verified_dataset, predictions, and corrections."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder = os.path.join(BACKUPS_DIR, f"backup_{timestamp}")
    os.makedirs(backup_folder, exist_ok=True)
    
    try:
        # Copy learning data files
        for filename in ["predictions.json", "corrections.json", "verified_dataset.json"]:
            src = os.path.join(LEARNING_DIR, filename)
            if os.path.exists(src):
                shutil.copy(src, os.path.join(backup_folder, filename))
                
        # Also copy users file for config safety
        shutil.copy(os.path.join(DATABASE_DIR, "users.json"), os.path.join(backup_folder, "users.json"))
        
        log_activity(username, "create_backup", {"backup_folder": f"backup_{timestamp}"})
        return f"backup_{timestamp}"
    except Exception as e:
        log_activity(username, "create_backup_failed", {"error": str(e)})
        raise e
