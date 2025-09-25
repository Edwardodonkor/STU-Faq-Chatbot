# AI-Powered Chatbot for University FAQs

This project is an AI-powered chatbot designed to assist students, staff, and prospective applicants by answering frequently asked questions (FAQs) about **Sunyani Technical University (STU)**.  
It provides instant responses, logs unanswered queries for admin review, and includes an admin dashboard for analytics.

---

## Features
- **Chatbot Interface:** User-friendly web UI where students can type questions and receive answers instantly.  
- **Voice Input:** Option to ask questions via speech recognition.  
- **Admin Dashboard:** View total, answered, and unanswered questions.  
- **Logging System:** Every query (answered/unanswered) is logged with a timestamp and user ID.  
- **Responsive Design:** Works seamlessly across mobile, tablet, and desktop.  

---

## Tools & Technologies
**Frontend**  
- HTML, CSS, Bootstrap 5  
- JavaScript  

**Backend**  
- Python (Flask)  
- Rasa (NLU & Dialogue Management)  

**Database**  
- MariaDB (via DBeaver for management)  

**Other Tools**  
- VS Code (IDE)  
- Git & GitHub (Version Control)  

---

## System Architecture
1. User interacts with the chatbot through the web interface.  
2. Rasa Model processes queries and generates responses.  
3. MariaDB stores logs of all queries and statistics.  
4. Admin Dashboard fetches log data for visualization and monitoring.  

---

## Installation & Setup

### 1. Clone Repository
python -m venv venv

# Activate environment
- source venv/bin/activate   # For Linux/Mac
- venv\Scripts\activate      # For Windows

# Install dependencies
pip install -r requirements.txt

#Setup Database
1. Create a MariaDB database.
2. Import the provided .sql file to set up tables for logs and statistics.
3. Update your DB credentials in config.py.

#Train RASA
rasa train

##Run the app
# Start Rasa server
rasa run -m models --enable-api --cors "*"

# Start Flask App
python app.py

###Authors
- Edward Ocansey
- Amoh George
- Raynolds Boateng
- Kusi Williams
Final Year Project, 2025
Sunyani Technical University
```bash
git clone https://github.com/Edwardodonkor/STU-Faq-Chatbot.git
cd STU-faq-chatbot
