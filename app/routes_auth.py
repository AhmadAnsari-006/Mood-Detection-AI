from flask import Blueprint, request, jsonify, make_response
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services import auth_service, db_service

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    fullName = data.get("fullName", "").strip()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password")

    if not fullName or not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    result = auth_service.register_user(fullName, username, email, password, role="user")
    if not result["success"]:
        return jsonify({"error": result["error"]}), 400

    # Return session details
    response = make_response(jsonify(result))
    response.set_cookie("session_token", result["token"], max_age=86400, httponly=True)
    return response

@auth_bp.route("/api/auth/signin", methods=["POST"])
def signin():
    data = request.get_json() or {}
    usernameOrEmail = data.get("username", "").strip()
    password = data.get("password")

    if not usernameOrEmail or not password:
        return jsonify({"error": "Username/Email and password are required"}), 400

    result = auth_service.authenticate_user(usernameOrEmail, password)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 400

    response = make_response(jsonify(result))
    response.set_cookie("session_token", result["token"], max_age=86400, httponly=True)
    return response

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("X-Session-Token") or request.cookies.get("session_token")
    auth_service.terminate_session(token)
    
    response = make_response(jsonify({"success": True, "message": "Logged out successfully"}))
    response.delete_cookie("session_token")
    return response

@auth_bp.route("/api/dev/login", methods=["POST"])
def dev_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    result = auth_service.authenticate_user(username, password, expected_role="developer")
    if not result["success"]:
        return jsonify({"error": result["error"]}), 401

    db_service.log_activity(username, "developer_login", {"message": "Developer logged in successfully"})
    
    response = make_response(jsonify(result))
    response.set_cookie("session_token", result["token"], max_age=86400, httponly=True)
    return response

@auth_bp.route("/api/dev/logout", methods=["POST"])
def dev_logout():
    token = request.headers.get("X-Session-Token") or request.cookies.get("session_token")
    user = auth_service.get_current_user()
    username = user["username"] if user else "developer"
    
    auth_service.terminate_session(token)
    db_service.log_activity(username, "developer_logout", {"message": "Developer logged out successfully"})
    
    response = make_response(jsonify({"success": True, "message": "Logged out successfully"}))
    response.delete_cookie("session_token")
    return response

@auth_bp.route("/api/auth/session", methods=["GET"])
def check_session():
    user = auth_service.get_current_user()
    if not user:
        return jsonify({"authenticated": False}), 401
    return jsonify({
        "authenticated": True,
        "user": {
            "userId": user["userId"],
            "username": user["username"],
            "email": user["email"],
            "fullName": user["fullName"],
            "role": user["role"]
        }
    })
