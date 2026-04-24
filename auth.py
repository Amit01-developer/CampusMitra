from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from db import firestore_db as fdb


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': 'Authentication required'}), 401
        return fn(*args, **kwargs)
    return wrapper


def get_current_user():
    uid = get_jwt_identity()
    doc = fdb.collection('users').document(uid).get()
    if not doc.exists:
        return None
    return {'id': doc.id, **doc.to_dict()}
