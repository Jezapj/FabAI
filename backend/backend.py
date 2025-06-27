from flask import Flask, jsonify
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





app.secret_key = 'supersecret'  # use a secure one in production

# DB Config
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:password@db:5432/mydb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# OAuth Config
oauth = OAuth(app)
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'openid email profile'}
)




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)