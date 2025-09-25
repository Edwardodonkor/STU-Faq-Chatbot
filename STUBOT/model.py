# models.py
from peewee import *
from flask import Flask
from datetime import datetime
from flask_login import UserMixin, LoginManager


# app = Flask(__name__)

# login_manager = LoginManager()

# Define the database connection
# Using SqliteDatabase for simplicity. It will create 'chatbot_logs.db' file.
db = SqliteDatabase("chatbot_logs.db")


class BaseModel(Model):
    """A base model that will use our Postgresql database."""

    class Meta:
        database = db


class User(BaseModel):
    username = CharField(unique=True)
    password = CharField()
    full_name = CharField()
    roll = CharField()


class ChatLog(BaseModel):
    user_id = CharField()
    user_message = TextField()
    bot_response = TextField()
    user_audio_filename = CharField(null=True)  # Add this field
    bot_audio_filename = CharField(null=True)  # Add this field
    timestamp = DateTimeField(default=datetime.now)


class ChartData(BaseModel):
    # Placeholder model for future chart data (e.g., number of queries per day)

    metric_name = CharField()  # e.g., 'total_queries', 'voice_queries'
    value = IntegerField()
    timestamp = DateTimeField(default=datetime.utcnow)


def initialize_db():
    """Initialize database and create tables"""
    db.connect()
    db.create_tables([User, ChatLog, ChartData], safe=True)
    # Create default admin user if not exists
    if not User.select().where(User.username == "admin").exists():
        from werkzeug.security import generate_password_hash

        default_password = generate_password_hash("admin123")
        User.create(
            username="admin",
            password=default_password,
            full_name="Administrator",
            roll="admin",
        )
        print("Default admin user created.")
        db.close()


if __name__ == "__main__":
    print("Database tables created/checked successfully!")
