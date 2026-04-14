import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

_cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
_cred_path = os.environ.get('FIREBASE_CREDENTIALS', 'serviceAccountKey.json')

if _cred_json:
    # Vercel: credentials as JSON string in env variable
    cred = credentials.Certificate(json.loads(_cred_json))
else:
    # Local: credentials from file
    cred = credentials.Certificate(_cred_path)

firebase_admin.initialize_app(cred)

firestore_db = firestore.client()
