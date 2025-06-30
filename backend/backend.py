#from models import User
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from flask import Flask, redirect, url_for, session, g
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth


app = Flask(__name__)

CORS(app)
@app.route("/")
def hello():
    return jsonify({"message": "Hello from Flask!"})


db_pw = os.getenv('DB_PW')


app.secret_key = 'supersecret'  # use a secure one in production

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
    api_base_url='https://www.googleapis.com/oauth2/v1/',  # <-- Needed!
    userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',  # <-- Add this!
    client_kwargs={
        'scope': 'openid email profile'
    }
)


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

    # Find or create user
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
    id = db.Column(db.Integer, primary_key=True)
    oauth_provider = db.Column(db.String(50))
    oauth_id = db.Column(db.String(255), unique=True)
    email = db.Column(db.String(120), unique=True)
    name = db.Column(db.String(120))



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)