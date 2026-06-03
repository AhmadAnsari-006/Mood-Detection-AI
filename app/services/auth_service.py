import uuid
from functools import wraps
from flask import request, jsonify, g
from datetime import datetime

from services import db_service


def get_current_user():
    """Retrieves current authenticated user from request header or cookies."""
    token = request.headers.get("X-Session-Token")
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        return None
        
    sessions = db_service.read_db("sessions")
    session = sessions.get(token)
    if not session:
        return None
        
    # Check if session has expired (e.g. 24h limit)
    # For a simple local dashboard, we can just return the session data
    return session

def login_required(f):
    """Decorator to ensure user is logged in."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def developer_required(f):
    """Decorator to ensure logged in user is a developer."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.get("role") != "developer":
            return jsonify({"error": "Forbidden: Developer access required"}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def register_user(full_name, username, email, password, role="user"):
    """Registers a new user in the database."""
    users = db_service.read_db("users")
    
    # Check if exists
    for u in users:
        if u["username"].lower() == username.lower():
            return {"success": False, "error": "Username is already taken"}
        if u["email"].lower() == email.lower():
            return {"success": False, "error": "Email is already registered"}
            
    # Add new user
    new_user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": email,
        "password": db_service.hash_password(password),
        "fullName": full_name,
        "role": role
    }
    
    users.append(new_user)
    db_service.write_db("users", users)
    
    # Automatically log in the user by generating a session
    return authenticate_user(username, password)

def authenticate_user(username_or_email, password, expected_role=None):
    """Authenticates user/developer and generates a session token."""
    users = db_service.read_db("users")
    hashed_pwd = db_service.hash_password(password)
    
    matched_user = None
    for u in users:
        if (u["username"].lower() == username_or_email.lower() or 
            u["email"].lower() == username_or_email.lower()):
            if u["password"] == hashed_pwd:
                matched_user = u
                break
                
    if not matched_user:
        return {"success": False, "error": "Invalid username/email or password"}
        
    if expected_role and matched_user["role"] != expected_role:
        return {"success": False, "error": f"Access denied: User does not have '{expected_role}' role"}
        
    # Generate token
    token = str(uuid.uuid4())
    sessions = db_service.read_db("sessions")
    
    sessions[token] = {
        "userId": matched_user["id"],
        "username": matched_user["username"],
        "email": matched_user["email"],
        "fullName": matched_user["fullName"],
        "role": matched_user["role"],
        "createdAt": datetime.now().isoformat()
    }
    
    db_service.write_db("sessions", sessions)
    
    # Return token & session details
    return {
        "success": True,
        "token": token,
        "user": {
            "userId": matched_user["id"],
            "username": matched_user["username"],
            "email": matched_user["email"],
            "fullName": matched_user["fullName"],
            "role": matched_user["role"]
        }
    }

def terminate_session(token):
    """Terminates an active user session."""
    if not token:
        return False
    sessions = db_service.read_db("sessions")
    if token in sessions:
        del sessions[token]
        db_service.write_db("sessions", sessions)
        return True
    return False
