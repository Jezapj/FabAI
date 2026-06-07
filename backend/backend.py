#from models import User
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from flask import Flask, redirect, url_for, session, g, send_file
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
from werkzeug.utils import secure_filename
import json
import torch

from torchvision import models, transforms
import torch.nn as nn
from PIL import Image as PILImage

from predictor import ClothingClassifier
from pathlib import Path
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

from assigner import clothingAssign


app = Flask(__name__)

#Get the absolute path of the directory containing this script
BASE_DIR = Path(__file__).resolve().parent

# Load the model once during the app startup
model = ClothingClassifier(
    model_path=os.path.join(BASE_DIR, 'models', 'fabAI_clothingClassifierHD.pth'),
    encoder_path=os.path.join(BASE_DIR, 'label_encoder.pkl')
)


CORS(app)
@app.route("/")
def hello():
    return jsonify({"message": "Hello from Flask!"})


db_pw = os.getenv('DB_PW')


app.secret_key = 'supersecret'  # use a secure one in production


#Define the upload folder relative to your script
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# DB Config
app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql://postgres:{db_pw}@db:5432/mydb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# OAuth Config
oauth = OAuth(app)
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['image']
    user_info = request.form.get('user_info')

    if not user_info:
        return jsonify({'error': 'User information is missing'}), 400

    user_info = json.loads(user_info)

    if not file or file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    token = user_info

    try:
        user_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name')

        user = User.query.filter_by(oauth_id=user_id).first()
        if not user:
            user = User(oauth_provider='google', oauth_id=user_id, email=email, name=name)
            db.session.add(user)
            db.session.commit()

        session['user_id'] = user.id

        filename = secure_filename(file.filename)
        user_folder = os.path.join(UPLOAD_FOLDER, str(user.id))
        os.makedirs(user_folder, exist_ok=True)

        filepath = os.path.join(user_folder, filename)
        file.save(filepath)

        new_image = Image(filename=filename, filepath=filepath, user_id=user.id)
        db.session.add(new_image)
        db.session.commit()

        return jsonify({
            'message': 'File uploaded',
            'filename': filename,
            'image_id': new_image.id
        })

    except ValueError:
        return jsonify({'error': 'Invalid token'}), 400

@app.route('/api/uploadnx', methods=['POST'])
def upload_file_nx():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['image']
    user_info = request.form.get('user_info')

    if not user_info:
        return jsonify({'error': 'User information is missing'}), 400

    user_info = json.loads(user_info)

    if not file or file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    token = user_info

    try:
        user_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name')

        user = User.query.filter_by(oauth_id=user_id).first()
        if not user:
            user = User(oauth_provider='google', oauth_id=user_id, email=email, name=name)
            db.session.add(user)
            db.session.commit()

        session['user_id'] = user.id

        filename = secure_filename(file.filename)
        user_folder = os.path.join(UPLOAD_FOLDER, str(user.id))
        os.makedirs(user_folder, exist_ok=True)

        filepath = os.path.join(user_folder, filename)
        file.save(filepath)

        # Predict clothing type
        label = model.predict(filepath)
        # Assign Heat Value
        value, category = clothingAssign(label, filepath)
        value = float(value)

        new_image = Image(filename=filename, filepath=filepath, user_id=user.id, label=label, value=value, category=category)
        db.session.add(new_image)
        db.session.commit()

        return jsonify({
            'message': 'File uploaded',
            'filename': filename,
            'image_id': new_image.id,
            'value': value,
            'category': category
        })

    except ValueError:
        return jsonify({'error': 'Invalid token'}), 400

@app.route('/api/image/<int:image_id>')
def serve_image(image_id):
    image = Image.query.filter_by(id=image_id).first()
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    return send_file(image.filepath, mimetype='image/jpeg')

@app.route('/login')
def login():
    redirect_uri = url_for('auth_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/auth/callback/google')
def auth_callback():
    print("Callback received:", request.args)

    if 'error' in request.args:
        return f"Error: {request.args['error']}", 400
    
    token = oauth.google.authorize_access_token()
    user_info = oauth.google.get('userinfo').json()

    user = User.query.filter_by(oauth_id=user_info['id']).first()
    if not user:
        user = User(
            oauth_provider='google',
            oauth_id=user_info['id'],
            email=user_info['email'],
            name=user_info['name']
        )
        db.session.add(user)
        db.session.commit()

    session['user_id'] = user.id
    return redirect('/profile')

@app.route("/api/auth", methods=["POST"])
def auth():
    token = request.json.get("id_token")
    try:
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), os.getenv("GOOGLE_CLIENT_ID"))
        email = idinfo['email']
        name = idinfo['name']
        sub = idinfo['sub']

        user = User.query.filter_by(oauth_id=sub).first()
        if not user:
            user = User(
                oauth_provider='google',
                oauth_id=sub,
                email=email,
                name=name
            )
            db.session.add(user)
            db.session.commit()

        return jsonify({"message": "Login success", "user": {"name": user.name, "email": user.email, "sub": sub}})
    except ValueError:
        return jsonify({"message": "Invalid token"}), 400
    
@app.before_request
def load_logged_in_user():
    user_id = session.get('user_id')
    g.user = User.query.get(user_id) if user_id else None

@app.route('/profile')
def profile():
    if not g.user:
        return redirect('/login')
    return f"Welcome, {g.user.name}! Email: {g.user.email}"

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    oauth_provider = db.Column(db.String(50))
    oauth_id = db.Column(db.String(255), unique=True)
    email = db.Column(db.String(120), unique=True)
    name = db.Column(db.String(120))
    images = db.relationship('Image', backref='user', lazy=True)

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255))
    filepath = db.Column(db.String(512))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    label = db.Column(db.String(50))
    value = db.Column(db.Float)  
    category = db.Column(db.String(50))

def distribute(target, user_id, db):
    user = db.session.query(User).filter_by(oauth_id=user_id).first()
    if not user:
        return []

    category_map = {
        "hat": ["Optional", "Head"],
        "top": ["Top"],
        "bot": ["Bottom"],
        "shoe": ["Shoes"]
    }

    images_by_cat = {
        "hat": [],
        "top": [],
        "bot": [],
        "shoe": []
    }

    for img in user.images:
        for group, valid_cats in category_map.items():
            if img.category in valid_cats:
                images_by_cat[group].append(img)

    # Always allow 'no hat' option
    images_by_cat["hat"].append(None)

    combos = []

    for hat in images_by_cat["hat"]:
        for top in images_by_cat["top"]:
            for bot in images_by_cat["bot"]:
                for shoe in images_by_cat["shoe"]:
                    combo = [hat, top, bot, shoe]
                    total_value = sum(img.value for img in combo if img is not None)
                    diff = abs(total_value - target)
                    combos.append({
                        "diff": diff,
                        "outfit": {
                            "hat": hat,
                            "top": top,
                            "bot": bot,
                            "shoe": shoe
                        }
                    })

    # Sort by diff
    combos.sort(key=lambda x: x["diff"])

    # Select top 3 with variety (guaranteeing one without a hat if available)
    results = []
    if not combos:
        return []

    # Get the overall best
    results.append(combos[0]["outfit"])

    # Force one with a different hat status (if possible)
    best_is_hatted = combos[0]["outfit"]["hat"] is not None

    # Try to find the best outfit with the opposite hat status
    other_hat_status_outfit = None
    for c in combos[1:]:
        current_is_hatted = c["outfit"]["hat"] is not None
        if current_is_hatted != best_is_hatted:
            other_hat_status_outfit = c["outfit"]
            break

    if other_hat_status_outfit:
        results.append(other_hat_status_outfit)

    # Fill remaining slots from the best available combos
    for c in combos[1:]:
        if len(results) >= 3:
            break
        if c["outfit"] not in results:
            results.append(c["outfit"])

    return results


@app.route('/api/predict_image/<int:image_id>', methods=['GET'])
def predict_image(image_id):
    image = Image.query.filter_by(id=image_id).first()
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    
    image_path = image.filepath
    # image_data = PILImage.open(image_path).convert('RGB') # Not used

    label = model.predict(image_path)
    
    return jsonify({'prediction': str(label)})

@app.route('/api/outfit', methods=['GET'])
def get_outfit():
    user_id = request.args.get('user_id')
    target = request.args.get('target', type=float)

    if not user_id or target is None:
        return jsonify({'error': 'Missing user_id or target'}), 400

    outfits = distribute(target, user_id, db)
    if not outfits:
        return jsonify([])

    results = []
    for outfit in outfits:
        results.append({
            part: {
                'id': item.id,
                'label': item.label,
                'value': item.value,
                'category': item.category
            } if item else None for part, item in outfit.items()
        })
    return jsonify(results)

# ── NEW: return all clothing items for a user ─────────────────────────────────
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
    user = User.query.filter_by(oauth_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    images = Image.query.filter_by(user_id=user.id).all()
    return jsonify([{
        'id':       img.id,
        'label':    img.label    or 'Unknown',
        'value':    float(img.value) if img.value is not None else 0.0,
        'category': img.category or 'Optional',
    } for img in images])

@app.route('/api/inventory/<int:image_id>', methods=['DELETE'])
def delete_item(image_id):
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404

    try:
        if os.path.exists(image.filepath):
            os.remove(image.filepath)
        db.session.delete(image)
        db.session.commit()
        return jsonify({'message': 'Item deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/<int:image_id>', methods=['PATCH'])
def update_item(image_id):
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404

    data = request.json
    if 'category' in data:
        image.category = data['category']
    if 'label' in data:
        image.label = data['label']

    # Re-calculate value if label or category changed
    new_value, _ = clothingAssign(image.label, image.filepath)
    image.value = float(new_value)

    db.session.commit()
    return jsonify({
        'id': image.id,
        'label': image.label,
        'category': image.category,
        'value': image.value
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
