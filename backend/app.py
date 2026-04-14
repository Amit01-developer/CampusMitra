from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from auth import login_required, get_current_user
from db import firestore_db as fdb
from datetime import datetime, timedelta
from google.cloud.firestore_v1 import FieldFilter
import firebase_admin.auth as fb_auth
from dotenv import load_dotenv
import os
import uuid

load_dotenv()

app = Flask(__name__, static_folder='..', static_url_path='')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET', 'campus-mitra-secret-2026')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

CORS(app, origins='*')
jwt = JWTManager(app)

# ── Helpers ──────────────────────────────────────────────────────────────────
def user_to_dict(uid, data):
    return {
        'id': uid,
        'name': data.get('name'),
        'email': data.get('email'),
        'department': data.get('department'),
        'year': data.get('year'),
        'campus_zone': data.get('campus_zone'),
        'trust_score': data.get('trust_score', 5.0),
        'is_verified': data.get('is_verified', False),
    }

def item_to_dict(doc_id, data, include_owner=True):
    result = {
        'id': doc_id,
        'name': data.get('name'),
        'description': data.get('description'),
        'price': data.get('price'),
        'price_amount': data.get('price_amount'),
        'price_unit': data.get('price_unit', 'day'),
        'condition': data.get('condition', 'Good'),
        'deposit': data.get('deposit'),
        'deposit_amount': data.get('deposit_amount'),
        'is_available': data.get('is_available', True),
        'campus_zone': data.get('campus_zone'),
        'category_id': data.get('category_slug'),
        'category_slug': data.get('category_slug'),
        'created_at': data.get('created_at', ''),
    }
    if include_owner:
        result['owner'] = data.get('owner', {})
    return result

def rental_to_dict(doc_id, data):
    return {
        'id': doc_id,
        'item_id': data.get('item_id'),
        'borrower_id': data.get('borrower_id'),
        'lender_id': data.get('lender_id'),
        'status': data.get('status', 'pending'),
        'rental_type': data.get('rental_type', 'rent'),
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'total_price': data.get('total_price'),
        'created_at': data.get('created_at', ''),
        'item': data.get('item_snapshot', {}),
    }

# ── Serve frontend ────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/owner-dashboard.html')
def owner_dashboard():
    return app.send_static_file('owner-dashboard.html')

@app.route('/borrower-dashboard.html')
def borrower_dashboard():
    return app.send_static_file('borrower-dashboard.html')

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not all(k in data for k in ['name', 'email', 'password']):
        return jsonify({'error': 'name, email and password are required'}), 400

    existing = fdb.collection('users').where(filter=FieldFilter('email', '==', data['email'])).limit(1).get()
    if existing:
        return jsonify({'error': 'Email already registered'}), 409

    uid = str(uuid.uuid4())
    user_data = {
        'name': data['name'],
        'email': data['email'],
        'password_hash': generate_password_hash(data['password']),
        'department': data.get('department', ''),
        'year': data.get('year', ''),
        'campus_zone': data.get('campus_zone', ''),
        'trust_score': 5.0,
        'is_verified': data['email'].endswith('.edu'),
        'created_at': datetime.utcnow().isoformat(),
    }
    fdb.collection('users').document(uid).set(user_data)
    token = create_access_token(identity=uid)
    return jsonify({'token': token, 'user': user_to_dict(uid, user_data)}), 201


@app.route('/api/auth/google', methods=['POST'])
def google_login():
    id_token = request.get_json().get('id_token')
    if not id_token:
        return jsonify({'error': 'id_token required'}), 400
    try:
        decoded = fb_auth.verify_id_token(id_token)
    except Exception as e:
        return jsonify({'error': 'Invalid Google token', 'detail': str(e)}), 401

    email = decoded.get('email', '')
    name = decoded.get('name', email.split('@')[0])
    google_uid = decoded.get('uid') or decoded.get('sub')

    # Find or create user
    existing = fdb.collection('users').where(filter=FieldFilter('email', '==', email)).limit(1).get()
    if existing:
        doc = existing[0]
        uid = doc.id
        udata = doc.to_dict()
    else:
        uid = google_uid or str(uuid.uuid4())
        udata = {
            'name': name,
            'email': email,
            'password_hash': '',
            'department': '',
            'year': '',
            'campus_zone': '',
            'trust_score': 5.0,
            'is_verified': True,
            'created_at': datetime.utcnow().isoformat(),
        }
        fdb.collection('users').document(uid).set(udata)

    token = create_access_token(identity=uid)
    return jsonify({'token': token, 'user': user_to_dict(uid, udata)})


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    docs = fdb.collection('users').where(filter=FieldFilter('email', '==', data.get('email', ''))).limit(1).get()
    if not docs:
        return jsonify({'error': 'Invalid email or password'}), 401
    doc = docs[0]
    udata = doc.to_dict()
    if not check_password_hash(udata.get('password_hash', ''), data.get('password', '')):
        return jsonify({'error': 'Invalid email or password'}), 401
    token = create_access_token(identity=doc.id)
    return jsonify({'token': token, 'user': user_to_dict(doc.id, udata)})


@app.route('/api/auth/me', methods=['GET'])
@login_required
def me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user_to_dict(user['id'], user))


# ── Categories ────────────────────────────────────────────────────────────────
@app.route('/api/categories', methods=['GET'])
def get_categories():
    docs = fdb.collection('categories').get()
    result = []
    for doc in docs:
        d = doc.to_dict()
        # compute stats
        items_docs = fdb.collection('items')\
            .where(filter=FieldFilter('category_slug', '==', d.get('slug')))\
            .where(filter=FieldFilter('is_available', '==', True)).get()
        item_count = len(items_docs)
        prices = [i.to_dict().get('price_amount', 0) for i in items_docs if i.to_dict().get('price_amount')]
        avg_price = round(sum(prices) / len(prices), 0) if prices else 0
        result.append({
            'id': doc.id,
            'slug': d.get('slug'),
            'name': d.get('name'),
            'description': d.get('description'),
            'icon': d.get('icon'),
            'color': d.get('color'),
            'stats': {
                'totalItems': item_count,
                'avgPrice': f'₹{int(avg_price)}/day',
                'availability': 'High' if item_count > 20 else 'Medium' if item_count > 10 else 'Low',
            }
        })
    return jsonify(result)


@app.route('/api/categories/<slug>', methods=['GET'])
def get_category(slug):
    docs = fdb.collection('categories').where(filter=FieldFilter('slug', '==', slug)).limit(1).get()
    if not docs:
        return jsonify({'error': 'Category not found'}), 404
    doc = docs[0]
    d = doc.to_dict()

    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    condition = request.args.get('condition')

    items_query = fdb.collection('items')\
        .where(filter=FieldFilter('category_slug', '==', slug))\
        .where(filter=FieldFilter('is_available', '==', True)).get()

    items = [item_to_dict(i.id, i.to_dict()) for i in items_query]
    if min_price is not None:
        items = [i for i in items if i.get('price_amount') and i['price_amount'] >= min_price]
    if max_price is not None:
        items = [i for i in items if i.get('price_amount') and i['price_amount'] <= max_price]
    if condition:
        items = [i for i in items if i.get('condition', '').lower() == condition.lower()]

    item_count = len(items)
    prices = [i.get('price_amount', 0) for i in items if i.get('price_amount')]
    avg_price = round(sum(prices) / len(prices), 0) if prices else 0

    return jsonify({
        'id': doc.id,
        'slug': d.get('slug'),
        'name': d.get('name'),
        'description': d.get('description'),
        'icon': d.get('icon'),
        'color': d.get('color'),
        'stats': {
            'totalItems': item_count,
            'avgPrice': f'₹{int(avg_price)}/day',
            'availability': 'High' if item_count > 20 else 'Medium' if item_count > 10 else 'Low',
        },
        'items': items,
    })


# ── Items ─────────────────────────────────────────────────────────────────────
@app.route('/api/items', methods=['GET'])
def get_items():
    category = request.args.get('category')
    condition = request.args.get('condition')
    available_only = request.args.get('available', 'true').lower() == 'true'
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    q = fdb.collection('items')
    if available_only:
        q = q.where(filter=FieldFilter('is_available', '==', True))
    if category:
        q = q.where(filter=FieldFilter('category_slug', '==', category))
    if condition:
        q = q.where(filter=FieldFilter('condition', '==', condition))

    docs = q.get()
    items = [item_to_dict(d.id, d.to_dict()) for d in docs]

    if min_price is not None:
        items = [i for i in items if i.get('price_amount') and i['price_amount'] >= min_price]
    if max_price is not None:
        items = [i for i in items if i.get('price_amount') and i['price_amount'] <= max_price]

    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return jsonify(items)


@app.route('/api/items/<item_id>', methods=['GET'])
def get_item(item_id):
    doc = fdb.collection('items').document(item_id).get()
    if not doc.exists:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify(item_to_dict(doc.id, doc.to_dict()))


@app.route('/api/items', methods=['POST'])
@login_required
def create_item():
    data = request.get_json()
    required = ['name', 'price', 'price_amount', 'category_slug']
    if not all(k in data for k in required):
        return jsonify({'error': f'Required fields: {required}'}), 400

    user = get_current_user()
    item_id = str(uuid.uuid4())
    item_data = {
        'name': data['name'],
        'description': data.get('description', ''),
        'price': data['price'],
        'price_amount': data['price_amount'],
        'price_unit': data.get('price_unit', 'day'),
        'condition': data.get('condition', 'Good'),
        'deposit': data.get('deposit', ''),
        'deposit_amount': data.get('deposit_amount'),
        'is_available': True,
        'campus_zone': data.get('campus_zone', user.get('campus_zone', '')),
        'category_slug': data['category_slug'],
        'owner_id': user['id'],
        'owner': {
            'id': user['id'],
            'name': user.get('name'),
            'department': user.get('department'),
            'trust_score': user.get('trust_score', 5.0),
        },
        'created_at': datetime.utcnow().isoformat(),
    }
    fdb.collection('items').document(item_id).set(item_data)
    return jsonify(item_to_dict(item_id, item_data)), 201


@app.route('/api/items/<item_id>', methods=['PUT'])
@login_required
def update_item(item_id):
    doc = fdb.collection('items').document(item_id).get()
    if not doc.exists:
        return jsonify({'error': 'Item not found'}), 404
    user = get_current_user()
    if doc.to_dict().get('owner_id') != user['id']:
        return jsonify({'error': 'Not your item'}), 403

    data = request.get_json()
    allowed = ['name', 'description', 'price', 'price_amount', 'price_unit',
               'condition', 'deposit', 'deposit_amount', 'is_available', 'campus_zone']
    update = {k: data[k] for k in allowed if k in data}
    fdb.collection('items').document(item_id).update(update)
    updated = fdb.collection('items').document(item_id).get()
    return jsonify(item_to_dict(updated.id, updated.to_dict()))


@app.route('/api/items/<item_id>', methods=['DELETE'])
@login_required
def delete_item(item_id):
    doc = fdb.collection('items').document(item_id).get()
    if not doc.exists:
        return jsonify({'error': 'Item not found'}), 404
    user = get_current_user()
    if doc.to_dict().get('owner_id') != user['id']:
        return jsonify({'error': 'Not your item'}), 403
    fdb.collection('items').document(item_id).delete()
    return jsonify({'message': 'Item deleted'})


# ── Search ────────────────────────────────────────────────────────────────────
@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    docs = fdb.collection('items').where(filter=FieldFilter('is_available', '==', True)).get()
    results = []
    for d in docs:
        data = d.to_dict()
        name = data.get('name', '').lower()
        desc = data.get('description', '').lower()
        if query in name or query in desc:
            results.append(item_to_dict(d.id, data))
        if len(results) >= 20:
            break
    return jsonify(results)


# ── Rentals ───────────────────────────────────────────────────────────────────
@app.route('/api/rentals', methods=['POST'])
@login_required
def create_rental():
    data = request.get_json()
    item_doc = fdb.collection('items').document(data.get('item_id', '')).get()
    if not item_doc.exists:
        return jsonify({'error': 'Item not found'}), 404
    item_data = item_doc.to_dict()

    if not item_data.get('is_available'):
        return jsonify({'error': 'Item is not available'}), 400

    user = get_current_user()
    if item_data.get('owner_id') == user['id']:
        return jsonify({'error': 'You cannot rent your own item'}), 400

    rental_id = str(uuid.uuid4())
    rental_data = {
        'item_id': item_doc.id,
        'borrower_id': user['id'],
        'lender_id': item_data.get('owner_id'),
        'rental_type': data.get('rental_type', 'rent'),
        'status': 'pending',
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'total_price': data.get('total_price'),
        'created_at': datetime.utcnow().isoformat(),
        'item_snapshot': item_to_dict(item_doc.id, item_data, include_owner=False),
    }
    fdb.collection('rentals').document(rental_id).set(rental_data)
    fdb.collection('items').document(item_doc.id).update({'is_available': False})
    return jsonify(rental_to_dict(rental_id, rental_data)), 201


@app.route('/api/rentals', methods=['GET'])
@login_required
def get_rentals():
    user = get_current_user()
    role = request.args.get('role', 'borrower')
    field = 'lender_id' if role == 'lender' else 'borrower_id'
    docs = fdb.collection('rentals').where(filter=FieldFilter(field, '==', user['id'])).get()
    return jsonify([rental_to_dict(d.id, d.to_dict()) for d in docs])


@app.route('/api/rentals/<rental_id>/status', methods=['PUT'])
@login_required
def update_rental_status(rental_id):
    doc = fdb.collection('rentals').document(rental_id).get()
    if not doc.exists:
        return jsonify({'error': 'Rental not found'}), 404
    user = get_current_user()
    rdata = doc.to_dict()
    if rdata.get('lender_id') != user['id'] and rdata.get('borrower_id') != user['id']:
        return jsonify({'error': 'Unauthorized'}), 403

    new_status = request.get_json().get('status')
    valid = ['pending', 'active', 'returned', 'cancelled']
    if new_status not in valid:
        return jsonify({'error': f'Status must be one of {valid}'}), 400

    fdb.collection('rentals').document(rental_id).update({'status': new_status})
    if new_status in ('returned', 'cancelled'):
        fdb.collection('items').document(rdata['item_id']).update({'is_available': True})

    updated = fdb.collection('rentals').document(rental_id).get()
    return jsonify(rental_to_dict(updated.id, updated.to_dict()))


# ── Stats ─────────────────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_items = len(fdb.collection('items').get())
    total_users = len(fdb.collection('users').get())
    rentals_docs = fdb.collection('rentals').get()
    total_rentals = sum(1 for d in rentals_docs if d.to_dict().get('status') in ('active', 'returned'))
    return jsonify({
        'total_items': total_items,
        'total_users': total_users,
        'total_rentals': total_rentals,
        'savings': total_rentals * 350,
        'satisfaction': 90,
    })


# ── Users ─────────────────────────────────────────────────────────────────────
@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    doc = fdb.collection('users').document(user_id).get()
    if not doc.exists:
        return jsonify({'error': 'User not found'}), 404
    udata = doc.to_dict()
    result = user_to_dict(doc.id, udata)
    items_docs = fdb.collection('items').where(filter=FieldFilter('owner_id', '==', user_id)).get()
    result['items'] = [item_to_dict(d.id, d.to_dict(), include_owner=False) for d in items_docs]
    return jsonify(result)


@app.route('/api/users/me', methods=['PUT'])
@login_required
def update_profile():
    user = get_current_user()
    data = request.get_json()
    allowed = ['name', 'department', 'year', 'campus_zone']
    update = {k: data[k] for k in allowed if k in data}
    fdb.collection('users').document(user['id']).update(update)
    updated = fdb.collection('users').document(user['id']).get()
    return jsonify(user_to_dict(updated.id, updated.to_dict()))


if __name__ == '__main__':
    app.run(debug=True, port=5000)
