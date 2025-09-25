# app.py
from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory,
    render_template,
    url_for,
    request,
    redirect,
    flash,
    session,
)
from werkzeug.security import check_password_hash
from playhouse.flask_utils import object_list
from datetime import datetime
import requests
import os, json
from gtts import gTTS  # Google Text-to-Speech library
from model import (
    db,
    ChatLog,
    ChartData,
    initialize_db,
    User,
)  # Import Peewee models and init function

# Initialize Flask app
app = Flask(__name__)


@app.context_processor
def utility_processor():
    return dict(min=min, max=max)


# --- Database Initialization ---
# Connect to the database and create tables on app startup
with app.app_context():
    initialize_db()

# --- Configuration for Rasa and TTS ---

RASA_SERVER_URL = "http://localhost:5005/webhooks/rest/webhook"
# RASA_SERVER_URL = "http://localhost:5005/webhooks/rest/webhook" # Default Rasa server URL
AUDIO_FOLDER = "static/audio"  # Folder to save generated audio files

# Create audio folder if it doesn't exist
if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

# --- Routes ---
# Admin Login
from functools import wraps


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("You need to log in first.", "info")
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)

    return decorated_function


def logout(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" in session:
            session.clear()
            flash("Logout.", "info")
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)

    return decorated_function


@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
    if "user_id" in session:
        return redirect(url_for("admin_dashboard"))
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        print(username, "  ", password)
        user = User.get_or_none(User.username == username)
        if user and check_password_hash(user.password, password):
            session["user_id"] = user.id
            session["username"] = user.username
            session["full_name"] = user.full_name
            session["roll"] = user.roll
            return redirect(url_for("admin_dashboard"))
        else:
            flash("Invalid username or incorrect password", "danger")
    return render_template("admin-login.html")


@app.route("/dashboard")
@login_required
def admin_dashboard():
    unanswered = [
        "Sorry, the chatbot service is currently unavailable.",
        "Sorry, I couldn't get a response from the bot.",
    ]
    total_questions = ChatLog.select().count()
    unanswered_questions = (
        ChatLog.select().where(ChatLog.bot_response.in_(unanswered)).count()
    )
    answered_questions = (
        ChatLog.select().where(ChatLog.bot_response.not_in(unanswered)).count()
    )

    return render_template(
        "admin-dashboard.html",
        answered_questions=answered_questions,
        total_questions=total_questions,
        unanswered_questions=unanswered_questions,
    )


@app.route("/admin/chatlogs")
@login_required
def chat_logs():
    """Chat logs with improved minimal pagination"""
    page = request.args.get("page", 1, type=int)
    per_page = 10

    # Ensure page is at least 1
    page = max(1, page)

    # Get total count
    total_count = ChatLog.select().count()

    # Calculate total pages
    total_pages = max(1, (total_count + per_page - 1) // per_page)

    # Ensure page doesn't exceed total pages
    page = min(page, total_pages)

    # Get paginated results
    chatlogs = (
        ChatLog.select().order_by(ChatLog.timestamp.desc()).paginate(page, per_page)
    )

    # Calculate has_next more accurately
    has_prev = page > 1
    has_next = page < total_pages

    # Calculate record range for display
    start_record = ((page - 1) * per_page) + 1 if total_count > 0 else 0
    end_record = min(page * per_page, total_count)

    return render_template(
        "chatlogs.html",
        chatlogs=chatlogs,
        page=page,
        per_page=per_page,
        total_count=total_count,
        total_pages=total_pages,
        has_prev=has_prev,
        has_next=has_next,
        start_record=start_record,
        end_record=end_record,
    )


# @app.route('/admin/delete-chat-log/<string:chat_id>')
# @login_required
# def delete_chat_log(chat_id):
#     chat = ChatLog.get(chat_id)
#     if chat:
#         print(chat)
#         ChatLog.delete_by_id(chat_id)
#     return redirect(url_for(chat_logs))
@app.route("/admin/delete-chat-log/<int:log_id>")
@login_required
def delete_chat_log(log_id):
    """Delete a specific chat log"""
    try:
        log = ChatLog.get_by_id(log_id)

        # Delete audio files if they exist
        if log.user_audio_filename and os.path.exists(
            os.path.join(AUDIO_FOLDER, log.user_audio_filename)
        ):
            os.remove(os.path.join(AUDIO_FOLDER, log.user_audio_filename))
        if log.bot_audio_filename and os.path.exists(
            os.path.join(AUDIO_FOLDER, log.bot_audio_filename)
        ):
            os.remove(os.path.join(AUDIO_FOLDER, log.bot_audio_filename))

        # Delete database record
        log.delete_instance()

        flash("Chat log deleted successfully!", "success")
    except ChatLog.DoesNotExist:
        flash("Chat log not found!", "error")
    except Exception as e:
        flash("Error deleting chat log!", "error")
        print(f"Error deleting chat log: {e}")

    return redirect(url_for("chat_logs"))


@app.route("/logout")
@logout
def admin_logout():
    return redirect(url_for("admin_login"))


# Serve static files (HTML, CSS, JS)
@app.route("/")
def index():
    """Serves the main HTML page."""
    return render_template("index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    """Serves other static files like CSS and JS."""
    return send_from_directory("static", filename)


@app.route("/about.html")
def about():
    """Serves the about page. Ensure about.html exists in static/"""
    return render_template("about.html")


@app.route("/chat", methods=["POST"])
def chat():
    """
    Handles incoming chat messages from the frontend.
    Now supports both text and voice audio uploads.
    """
    user_id = request.form.get("userId", "anonymous")
    user_message = request.form.get("message", "")

    # Handle voice audio file if present
    user_audio_filename = None
    user_audio_url = None

    if "voice_audio" in request.files:
        voice_file = request.files["voice_audio"]
        if voice_file and voice_file.filename != "":
            user_audio_filename = (
                f"user_voice_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.wav"
            )
            user_audio_path = os.path.join(AUDIO_FOLDER, user_audio_filename)
            voice_file.save(user_audio_path)
            user_audio_url = f"/{AUDIO_FOLDER}/{user_audio_filename}"

    # If no voice file but we have text, create TTS as fallback
    elif user_message:
        try:
            user_audio_filename = (
                f"user_tts_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
            )
            user_audio_path = os.path.join(AUDIO_FOLDER, user_audio_filename)
            user_tts = gTTS(text=user_message, lang="en", slow=False, tld="com")
            user_tts.save(user_audio_path)
            user_audio_url = f"/{AUDIO_FOLDER}/{user_audio_filename}"
        except Exception as e:
            print(f"Error generating user TTS audio: {e}")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    bot_response_text = "Sorry, I couldn't get a response from the bot."
    bot_audio_url = None
    bot_audio_filename = None

    try:
        # Send message to Rasa chatbot
        rasa_payload = {"sender": user_id, "message": user_message}
        rasa_response = requests.post(RASA_SERVER_URL, json=rasa_payload)
        rasa_response.raise_for_status()
        bot_responses = rasa_response.json()

        if bot_responses:
            bot_response_text = bot_responses[0].get("text", bot_response_text)

            # Generate TTS audio for the bot's response
            try:
                bot_audio_filename = (
                    f"bot_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
                )
                bot_audio_path = os.path.join(AUDIO_FOLDER, bot_audio_filename)
                bot_tts = gTTS(text=bot_response_text, lang="en", slow=False, tld="com")
                bot_tts.save(bot_audio_path)
                bot_audio_url = f"/{AUDIO_FOLDER}/{bot_audio_filename}"
            except Exception as e:
                print(f"Error generating bot TTS audio: {e}")

    except requests.exceptions.ConnectionError:
        bot_response_text = "Sorry, the chatbot service is currently unavailable. Please try again later."
    except Exception as e:
        print(f"Error: {e}")

    # Log the chat interaction - FIXED MODEL NAME
    try:
        ChatLog.create(
            user_id=user_id,
            user_message=user_message,
            bot_response=bot_response_text,
            user_audio_filename=user_audio_filename,
            bot_audio_filename=bot_audio_filename,  # FIXED: No split needed
            timestamp=datetime.utcnow(),
        )
        print("Chat interaction logged to database.")
    except Exception as e:
        print(f"Error logging chat interaction to database: {e}")

    return jsonify(
        {
            "response": bot_response_text,
            "user_audio_url": None,
            "bot_audio_url": bot_audio_url,
        }
    )


# --- Run the Flask app ---
if __name__ == "__main__":
    # Ensure the static/audio directory exists
    if not os.path.exists(AUDIO_FOLDER):
        os.makedirs(AUDIO_FOLDER)
    app.secret_key = "Lc6AI3fIZpFUrJjWE33"
    app.run(debug=True, port=5000)  # Run on port 5000
