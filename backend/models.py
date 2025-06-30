"""from backend import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    oauth_provider = db.Column(db.String(50))
    oauth_id = db.Column(db.String(255), unique=True)
    email = db.Column(db.String(120), unique=True)
    name = db.Column(db.String(120))"""
