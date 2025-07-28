# app.py
from flask import Flask, request, jsonify, send_from_directory, render_template, url_for
from datetime import datetime
import requests
import os
from gtts import gTTS # Google Text-to-Speech library
from model import db, ChatLog, ChartData, initialize_db # Import Peewee models and init function

# Initialize Flask app
app = Flask(__name__)

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
                tts = gTTS(text=bot_response_text, lang='en', slow=False)
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
    app.run(debug=True, port=5000) # Run on port 5000
