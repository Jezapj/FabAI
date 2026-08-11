#from models import User
from flask_cors import CORS
import os
import re
import threading
from io import BytesIO
from flask import Flask, jsonify, request, Response, redirect, url_for, session, g
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
from werkzeug.utils import secure_filename
import json
from PIL import Image as PILImage

from pathlib import Path
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

from assigner import (
    clothingAssign,
    get_dominant_color,
    get_formality_score,
    is_rain_friendly,
    is_rain_unfriendly,
    NEUTRAL_COLORS,
    DARK_COLORS,
)


app = Flask(__name__)

#Get the absolute path of the directory containing this script
BASE_DIR = Path(__file__).resolve().parent

_model = None
_model_lock = threading.Lock()


def get_model():
    """Load PyTorch classifier on first use so gunicorn can boot on low-RAM instances."""
    from predictor import ClothingClassifier

    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                use_fp16 = os.getenv('MODEL_FP16', '').lower() in ('1', 'true', 'yes')
                _model = ClothingClassifier(
                    model_path=os.path.join(BASE_DIR, 'models', 'fabAI_clothingClassifierHD.pth'),
                    encoder_path=os.path.join(BASE_DIR, 'label_encoder.pkl'),
                    use_fp16=use_fp16,
                )
    return _model


def build_cors_origins():
    origins: list = [
        re.compile(r"https://[\w-]+\.onrender\.com"),
        re.compile(r"https://[\w-]+\.up\.railway\.app"),
    ]
    default_local = "http://localhost:3000"
    raw = os.getenv("CORS_ORIGINS", default_local)
    for part in raw.split(","):
        origin = part.strip()
        if origin:
            origins.append(origin)
    front = os.getenv("FRONTEND_URL", "").strip()
    if front:
        origins.append(front)
    return origins


CORS(app, resources={r"/*": {
    "origins": build_cors_origins(),
    "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Content-Type"],
    "max_age": 86400,
}})


@app.after_request
def apply_cors_fallback(response):
    """Ensure CORS on responses (including errors) when Origin is allowed."""
    origin = request.headers.get("Origin")
    if not origin:
        return response

    allowed_exact = {
        "http://localhost:3000",
        *(p.strip() for p in os.getenv("CORS_ORIGINS", "").split(",") if p.strip()),
    }
    front = os.getenv("FRONTEND_URL", "").strip()
    if front:
        allowed_exact.add(front)

    if origin in allowed_exact or re.fullmatch(r"https://[\w-]+\.onrender\.com", origin) or re.fullmatch(
        r"https://[\w-]+\.up\.railway\.app", origin
    ):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        response.headers["Vary"] = "Origin"
    return response


@app.route("/api/<path:_any>", methods=["OPTIONS"])
@app.route("/health", methods=["OPTIONS"])
@app.route("/", methods=["OPTIONS"])
def cors_preflight(_any=None):
    return ("", 204)


def get_database_uri() -> str:
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        return database_url

    db_pw = os.getenv('DB_PW', 'password')
    db_host = os.getenv('DB_HOST', 'db')
    db_name = os.getenv('DB_NAME', 'mydb')
    db_user = os.getenv('DB_USER', 'postgres')
    return f'postgresql://{db_user}:{db_pw}@{db_host}:5432/{db_name}'


app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-only-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'connect_args': {'connect_timeout': 10},
}
db = SQLAlchemy(app)

_db_initialized = False


@app.route("/health")
def health():
    """Fast healthcheck for Railway (no DB required)."""
    return jsonify({
        "ok": True,
        "service": "fabai-api",
        "port": os.getenv("PORT"),
    }), 200

@app.route("/")
def hello():
    return jsonify({"message": "FabAI API"})

@app.teardown_appcontext
def shutdown_session(exception=None):
    db.session.remove()

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
# legacy: UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
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

    try:
        user_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name')
        provider = 'guest' if user_info.get('guest') else 'google'

        user = User.query.filter_by(oauth_id=user_id).first()
        if not user:
            user = User(oauth_provider=provider, oauth_id=user_id, email=email, name=name)
            db.session.add(user)
            db.session.commit()

        session['user_id'] = user.id

        filename = secure_filename(file.filename or 'upload.jpg')
        image_bytes = file.read()

        # Save bytes only — no PIL/ML here (keeps upload fast and avoids OOM on free tier).
        # Classification updates label/category/color via /api/classify_image.
        new_image = Image(
            filename=filename,
            mimetype=file.mimetype or 'image/jpeg',
            data=image_bytes,
            user_id=user.id,
            label='Unclassified',
            value=0.0,
            category='Optional',
            color='grey',
        )
        db.session.add(new_image)
        db.session.commit()

        return jsonify({
            'message': 'File uploaded',
            'filename': filename,
            'image_id': new_image.id,
            'value': 0.0,
            'category': 'Optional',
            'label': 'Unclassified',
            'needs_classification': True,
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f'uploadnx error: {e}')
        return jsonify({'error': 'Upload failed. Try again in a moment.'}), 500

@app.route('/api/image/<int:image_id>')
def serve_image(image_id):
    image = Image.query.filter_by(id=image_id).first()
    if not image or not image.data:
        return jsonify({'error': 'Image not found'}), 404
    return Response(image.data, mimetype=image.mimetype or 'image/jpeg')

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
    mimetype = db.Column(db.String(50))
    data = db.Column(db.LargeBinary)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    label = db.Column(db.String(50))
    value = db.Column(db.Float)
    category = db.Column(db.String(50))
    color = db.Column(db.String(30))

RAIN_WEATHER_CODES = frozenset({
    51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99,
})

COLOR_PRESETS = {
    'any': 'Any colours',
    'accent_black': 'Single accent + black',
    'earth_sky': 'Light brown + light blue',
    'neutrals': 'Neutrals only',
}


def is_rainy_weather(weather_code) -> bool:
    try:
        return int(weather_code) in RAIN_WEATHER_CODES
    except (TypeError, ValueError):
        return False


def item_color(img, color_cache: dict | None = None) -> str:
    if color_cache is not None and img.id in color_cache:
        return color_cache[img.id]
    if img.color:
        return img.color
    return 'grey'


def build_color_cache(images) -> dict:
    """Compute each item's colour once per request to avoid repeated PIL/DB work."""
    cache = {}
    needs_commit = False
    for img in images:
        if img.color:
            cache[img.id] = img.color
            continue
        if img.data:
            pil = PILImage.open(BytesIO(img.data))
            try:
                color = get_dominant_color(pil)
            finally:
                pil.close()
            img.color = color
            cache[img.id] = color
            needs_commit = True
        else:
            cache[img.id] = 'grey'
    if needs_commit:
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
    return cache


def score_color_harmony(colors: list[str], preset: str) -> float:
    if preset == 'any' or not colors:
        return 0.0

    unique = set(colors)
    non_neutral = [c for c in unique if c not in NEUTRAL_COLORS]

    if preset == 'neutrals':
        return 0.0 if not non_neutral else len(non_neutral) * 12

    if preset == 'accent_black':
        if 'black' not in unique:
            return 18
        if len(non_neutral) > 1:
            return (len(non_neutral) - 1) * 14
        return 0.0

    if preset == 'earth_sky':
        browns = unique & {'brown', 'lightbrown'}
        blues = unique & {'blue', 'lightblue', 'navy'}
        penalty = 0.0
        if not browns:
            penalty += 16
        if not blues:
            penalty += 16
        extras = [c for c in non_neutral if c not in {'brown', 'lightbrown', 'blue', 'lightblue', 'navy'}]
        penalty += len(extras) * 8
        return penalty

    return 0.0


def score_formality(items, formality: str, color_cache: dict) -> float:
    if formality != 'formal':
        return 0.0

    penalty = 0.0
    for img in items:
        if not img:
            continue
        label_score = get_formality_score(img.label or '')
        penalty += max(0, 7 - label_score) * 2

        color = item_color(img, color_cache)
        if color not in DARK_COLORS and color not in NEUTRAL_COLORS:
            penalty += 6
        elif color in {'white', 'beige', 'lightblue', 'pink', 'yellow', 'orange'}:
            penalty += 4

    return penalty


def score_rain(items, rainy: bool) -> float:
    if not rainy:
        return 0.0

    penalty = 0.0
    for img in items:
        if not img:
            continue
        label = img.label or ''
        if is_rain_friendly(label):
            penalty -= 6
        elif is_rain_unfriendly(label):
            penalty += 14
    return penalty


def distribute(target, user_id, db, weather_code=None, formality='casual', color_preset='any'):
    user = db.session.query(User).filter_by(oauth_id=user_id).first()
    if not user:
        return []

    images = list(user.images)
    color_cache = build_color_cache(images)

    rainy = is_rainy_weather(weather_code)
    if rainy:
        target += 12

    category_map = {
        "hat": ["Optional", "Head"],
        "top": ["Top", "One piece"],
        "bot": ["Bottom"],
        "shoe": ["Shoes"]
    }

    images_by_cat = {
        "hat": [],
        "top": [],
        "bot": [],
        "shoe": []
    }

    for img in images:
        for group, valid_cats in category_map.items():
            if img.category in valid_cats:
                images_by_cat[group].append(img)

    if formality == 'formal':
        images_by_cat["hat"] = [None]
    elif not images_by_cat["hat"]:
        images_by_cat["hat"] = [None]

    if not images_by_cat["top"] or not images_by_cat["shoe"]:
        return []

    # One-piece outfits can omit a separate bottom
    if not images_by_cat["bot"]:
        images_by_cat["bot"] = [None]

    combos = []

    for hat in images_by_cat["hat"]:
        for top in images_by_cat["top"]:
            for bot in images_by_cat["bot"]:
                for shoe in images_by_cat["shoe"]:
                    if bot is not None and top.category == 'One piece':
                        continue

                    combo = [hat, top, bot, shoe]
                    active = [img for img in combo if img is not None]
                    if not active:
                        continue

                    total_value = sum(img.value for img in active)
                    warmth_diff = abs(total_value - target)
                    colors = [item_color(img, color_cache) for img in active]
                    color_penalty = score_color_harmony(colors, color_preset)
                    formality_penalty = score_formality(active, formality, color_cache)
                    rain_penalty = score_rain(active, rainy)

                    total_score = (
                        warmth_diff
                        + color_penalty * 0.45
                        + formality_penalty * 0.35
                        + rain_penalty * 0.55
                    )

                    combos.append({
                        "score": total_score,
                        "outfit": {
                            "hat": hat,
                            "top": top,
                            "bot": bot,
                            "shoe": shoe
                        }
                    })

    combos.sort(key=lambda x: x["score"])
    return [c["outfit"] for c in combos[:3]]


@app.route('/api/classify_image/<int:image_id>', methods=['POST'])
def classify_image(image_id):
    image = Image.query.filter_by(id=image_id).first()
    if not image or not image.data:
        return jsonify({'error': 'Image not found'}), 404

    try:
        pil_image = PILImage.open(BytesIO(image.data))
        label = get_model().predict(pil_image)
        value, category, color = clothingAssign(label, pil_image)
        image.label = label
        image.value = float(value)
        image.category = category
        image.color = color
        db.session.commit()
        return jsonify({
            'prediction': str(label),
            'label': label,
            'category': category,
            'value': image.value,
            'color': color,
        })
    except Exception as e:
        print(f'classify_image error: {e}')
        db.session.rollback()
        return jsonify({
            'error': 'Classification failed. The AI may still be starting; try again in a minute.',
        }), 500


@app.route('/api/predict_image/<int:image_id>', methods=['GET'])
def predict_image(image_id):
    image = Image.query.filter_by(id=image_id).first()
    if not image or not image.data:
        return jsonify({'error': 'Image not found'}), 404

    pil_image = PILImage.open(BytesIO(image.data))
    label = get_model().predict(pil_image)

    return jsonify({'prediction': str(label)})

@app.route('/api/outfit', methods=['GET'])
def get_outfit():
    user_id = request.args.get('user_id')
    target = request.args.get('target', type=float)
    weather_code = request.args.get('weather_code', type=int)
    formality = request.args.get('formality', 'casual')
    color_preset = request.args.get('color_preset', 'any')

    if not user_id or target is None:
        return jsonify({'error': 'Missing user_id or target'}), 400

    if formality not in ('casual', 'formal'):
        formality = 'casual'
    if color_preset not in COLOR_PRESETS:
        color_preset = 'any'

    outfits = distribute(
        target, user_id, db,
        weather_code=weather_code,
        formality=formality,
        color_preset=color_preset,
    )
    if not outfits:
        return jsonify([])

    results = []
    for outfit in outfits:
        results.append({
            part: {
                'id': item.id,
                'label': item.label,
                'value': item.value,
                'category': item.category,
                'color': item.color or 'grey',
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
    color_cache = build_color_cache(images)
    return jsonify([{
        'id':       img.id,
        'label':    img.label    or 'Unknown',
        'value':    float(img.value) if img.value is not None else 0.0,
        'category': img.category or 'Optional',
        'color':    color_cache.get(img.id, 'grey'),
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

    pil_image = PILImage.open(BytesIO(image.data))
    new_value, _, new_color = clothingAssign(image.label, pil_image)
    image.value = float(new_value)
    image.color = new_color

    db.session.commit()
    return jsonify({
        'id': image.id,
        'label': image.label,
        'category': image.category,
        'value': image.value,
        'color': image.color,
    })


def init_db():
    global _db_initialized
    if _db_initialized:
        return
    if not os.getenv('DATABASE_URL'):
        print('init_db skipped: DATABASE_URL is not set (link Postgres on Railway)')
        return
    try:
        with app.app_context():
            db.create_all()
            try:
                db.session.execute(db.text(
                    "ALTER TABLE image ADD COLUMN IF NOT EXISTS color VARCHAR(30)"
                ))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"Color column migration note: {e}")
        _db_initialized = True
    except Exception as e:
        print(f"init_db failed (will retry on next request): {e}")


@app.before_request
def ensure_db_ready():
    if request.path in ('/health', '/') and request.method == 'GET':
        return None
    init_db()


if __name__ == "__main__":
    port = int(os.getenv('PORT', 5000))
    app.run(host="0.0.0.0", port=port)
