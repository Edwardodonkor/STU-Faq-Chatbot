# app.py
from flask import Flask, request, jsonify, send_from_directory, render_template, url_for, request, redirect, flash, session
from werkzeug.security import check_password_hash
from playhouse.flask_utils import object_list
from datetime import datetime
import requests
import os
from gtts import gTTS # Google Text-to-Speech library
from model import db, ChatLog, ChartData, initialize_db, User # Import Peewee models and init function

# Initialize Flask app
app = Flask(__name__)

# login_manager = LoginManager()

# login_manager.init_app(app)

# --- Database Initialization ---
# Connect to the database and create tables on app startup
with app.app_context():
    initialize_db()

# --- Configuration for Rasa and TTS ---

RASA_SERVER_URL = "http://localhost:5005/webhooks/rest/webhook"
# RASA_SERVER_URL = "http://localhost:5005/webhooks/rest/webhook" # Default Rasa server URL
AUDIO_FOLDER = 'static/audio' # Folder to save generated audio files

# Create audio folder if it doesn't exist
if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

# --- Routes ---
# Admin Login
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('You need to log in first.', 'info')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def logout(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' in session:
            session.clear()
            flash('Logout.', 'info')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/admin-login', methods =['GET','POST'])
def admin_login():
    if 'user_id' in session:
        return redirect(url_for('admin_dashboard'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        print(username,'  ' ,password)
        user = User.get_or_none(User.username == username)
        if user and check_password_hash(user.password, password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['full_name'] = user.full_name
            session['roll'] = user.roll
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid username or incorrect password','danger')
    return render_template('admin-login.html')

@app.route('/dashboard')
@login_required
def admin_dashboard():
    unanswered = ["Sorry, the chatbot service is currently unavailable.", "Sorry, I couldn't get a response from the bot."]
    total_questions = ChatLog.select().count()
    unanswered_questions = ChatLog.select().where(ChatLog.bot_response.contains('Sorry, the chatbot service is currently unavailable.') or ChatLog.bot_response.contains("Sorry, I couldn't get a response from the bot.")).count()
    answered_questions = ChatLog.select().where(ChatLog.bot_response.not_in(unanswered)).count()

    return render_template('admin-dashboard.html', answered_questions = answered_questions,total_questions = total_questions, unanswered_questions = unanswered_questions)


@app.route('/admin/chatlogs')
@login_required
def chat_logs():
    chatlogs = ChatLog.select()
    return render_template('chatlogs.html', chatlogs = chatlogs)


@app.route('/logout')
@logout
def admin_logout():
    return redirect(url_for('admin_login'))

# Serve static files (HTML, CSS, JS)
@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serves other static files like CSS and JS."""
    return send_from_directory('static', filename)

@app.route('/about.html')
def about():
    """Serves the about page. Ensure about.html exists in static/"""
    return render_template('about.html')


@app.route('/chat', methods=['POST'])
def chat():
    """
    Handles incoming chat messages from the frontend.
    Processes text input, sends to Rasa, gets response, converts to speech, and logs.
    """
    user_message = request.json.get('message')
    user_id = request.json.get('userId', 'anonymous') # Get user ID from frontend or default

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    print(f"Received message from {user_id}: {user_message}")

    bot_response_text = "Sorry, I couldn't get a response from the bot."
    audio_url = None

    try:
        # Send message to Rasa chatbot
        rasa_payload = {
            "sender": user_id,
            "message": user_message
        }
        rasa_response = requests.post(RASA_SERVER_URL, json=rasa_payload)
        rasa_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        bot_responses = rasa_response.json()

        if bot_responses:
            # Assume Rasa sends a list of responses, take the first text response
            bot_response_text = bot_responses[0].get('text', bot_response_text)
            print(f"Rasa response: {bot_response_text}")

            # Generate TTS audio for the bot's response
            try:
                tts = gTTS(text=bot_response_text, lang='en', slow=False, tld='com')
                audio_filename = f"bot_response_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
                audio_path = os.path.join(AUDIO_FOLDER, audio_filename)
                tts.save(audio_path)
                audio_url = f"/{AUDIO_FOLDER}/{audio_filename}" # URL relative to Flask app root
            except Exception as e:
                print(f"Error generating TTS audio: {e}")
                audio_url = None # Ensure audio_url is None if TTS fails

    except requests.exceptions.ConnectionError:
        bot_response_text = "Sorry, the chatbot service is currently unavailable. Please try again later."
        print("Error: Could not connect to Rasa server.")
    except requests.exceptions.RequestException as e:
        bot_response_text = "An error occurred while communicating with the chatbot service."
        print(f"Error from Rasa server: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        bot_response_text = "An unexpected error occurred. Please try again."

    # Log the chat interaction using Peewee
    try:
        db.connect() # Connect to DB for this operation
        ChatLog.create(
            user_id=user_id,
            user_message=user_message,
            bot_response=bot_response_text,
            timestamp=datetime.utcnow()
        )
        print("Chat interaction logged to database.")
    except Exception as e:
        print(f"Error logging chat interaction to database: {e}")
    finally:
        if not db.is_closed():
            db.close() # Close DB connection

    return jsonify({
        "response": bot_response_text,
        "audio_url": audio_url
    })

# --- Run the Flask app ---
if __name__ == '__main__':
    # Ensure the static/audio directory exists
    if not os.path.exists(AUDIO_FOLDER):
        os.makedirs(AUDIO_FOLDER)
    app.secret_key = 'Lc6AI3fIZpFUrJjWE33'
    app.run(debug=True, port=5000) # Run on port 5000
