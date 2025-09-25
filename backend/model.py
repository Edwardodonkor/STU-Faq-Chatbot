# models.py
from peewee import *
from flask import Flask
from datetime import datetime
from flask_login import UserMixin, LoginManager


# app = Flask(__name__)

# login_manager = LoginManager()

# Define the database connection
# Using SqliteDatabase for simplicity. It will create 'chatbot_logs.db' file.
db = SqliteDatabase('chatbot_logs.db')

class BaseModel(Model):
    """A base model that will use our Postgresql database."""
    class Meta:
        database = db

# @login_manager.user_loader
# def load_user(user_id):
#     try:
#         user = User.get_by_id(user_id)
#         return user
#     except DoesNotExist:
#         pass
#     return None

class User(BaseModel,UserMixin):
    username = CharField()
    password = CharField()
    full_name = CharField()
    roll = IntegerField(default=111)

    class Meta:
        table_name = 'user'

class ChatLog(BaseModel):
    """
    Model to store chat interactions (user message and bot response).
    """
    user_id = CharField() # To identify the user (e.g., session ID)
    user_message = TextField()
    bot_response = TextField()
    timestamp = DateTimeField(default=datetime.utcnow) # Automatically record creation time

    class Meta:
        table_name = 'chat_logs' # Explicitly define table name

class ChartData(BaseModel):
    """
    Placeholder model for future chart data (e.g., number of queries per day).
    """
    metric_name = CharField() # e.g., 'total_queries', 'voice_queries'
    value = IntegerField()
    timestamp = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = 'chart_data' # Explicitly define table name

# Function to initialize the database and create tables
def initialize_db():
    db.connect()
    db.create_tables([ChatLog, ChartData,User])
    db.close()

if __name__ == '__main__':
    # This block will run if models.py is executed directly
    initialize_db()
    print("Database tables created/checked successfully!")
