import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

_cred_json    = os.environ.get('FIREBASE_CREDENTIALS_JSON')
_default_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
_cred_path    = os.environ.get('FIREBASE_CREDENTIALS', _default_path)

if _cred_json:
    cred = credentials.Certificate(json.loads(_cred_json))
else:
    cred = credentials.Certificate(_cred_path)

firebase_admin.initialize_app(cred, {
    'storageBucket': 'campus-share-2f42b.appspot.com'
})

firestore_db = firestore.client()
