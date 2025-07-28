// DOM element references and global variables
let chatInput, sendBtn, chatMessages, voiceInputBtn, initialWelcome;
let recognition = null;
let isListening = false;
let isProcessing = false;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    chatInput = document.getElementById('chatInput');
    sendBtn = document.getElementById('sendBtn');
    chatMessages = document.getElementById('chatMessages');
    voiceInputBtn = document.getElementById('voiceInputBtn');
    initialWelcome = document.querySelector('.initial-welcome');
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check speech recognition support
    checkSpeechRecognitionSupport();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Send button click event
    sendBtn.addEventListener('click', handleSendMessage);
    
    // Enter key event for chat input
    chatInput.addEventListener('keydown', handleKeydown);
    
    // Voice input button click event
    voiceInputBtn.addEventListener('click', handleVoiceInput);
    
    // Prevent form submission if input is in a form
    chatInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });
    
    // Focus input when page loads
    chatInput.focus();
}

/**
 * Handle keydown events for the chat input
 */
function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        
        // Don't send if already processing or listening
        if (isListening || isProcessing) {
            return;
        }
        
        handleSendMessage();
    }
}

/**
 * Handle sending a message
 */
function handleSendMessage() {
    const message = chatInput.value.trim();
    
    if (!message) {
        return;
    }
    
    // Prevent multiple sends
    if (isProcessing) {
        return;
    }
    
    isProcessing = true;
    
    // Add user message
    appendMessage('user', message);
    
    // Clear input
    chatInput.value = '';
    
    // Simulate bot response (replace with actual API call)
    setTimeout(() => {
        appendMessage('bot', generateBotResponse(message));
        isProcessing = false;
        chatInput.focus();
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
}

/**
 * Generate a bot response (placeholder - replace with actual API integration)
 */
function generateBotResponse(userMessage) {
    const responses = [
        "Thank you for your question about Sunyani Technical University. How can I assist you further?",
        "I'm here to help with information about STU. What would you like to know?",
        "That's an interesting question. Let me provide you with relevant information about our university.",
        "I understand you're looking for information about STU. I'm happy to help!",
        "Great question! Sunyani Technical University offers many programs and services."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Append a message to the chat
 */
function appendMessage(sender, text, isTemporary = false) {
    // Hide welcome message on first message
    if (initialWelcome && initialWelcome.style.display !== 'none') {
        initialWelcome.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message-bubble');
    
    if (isTemporary) {
        messageDiv.classList.add('temp-message');
    } else {
        messageDiv.classList.add(sender + '-message');
    }
    
    messageDiv.textContent = text;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
    
    // Remove temporary messages after animation
    if (isTemporary) {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
    
    return messageDiv;
}

/**
 * Check if speech recognition is supported
 */
function checkSpeechRecognitionSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        voiceInputBtn.style.opacity = '0.5';
        voiceInputBtn.title = 'Speech recognition not supported in this browser';
        return false;
    }
    
    voiceInputBtn.title = 'Click to use voice input';
    return true;
}

/**
 * Handle voice input button click
 */
function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        appendMessage('system', "Sorry, your browser doesn't support Speech Recognition.");
        return;
    }
    
    // If already listening, stop
    if (isListening) {
        stopVoiceRecognition();
        return;
    }
    
    // If processing, don't start new recognition
    if (isProcessing) {
        showTemporaryMessage("Please wait for the current message to be processed.");
        return;
    }
    
    startVoiceRecognition();
}

/**
 * Start voice recognition
 */
function startVoiceRecognition() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Configure recognition
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;
        
        // Set up event handlers
        recognition.onstart = handleRecognitionStart;
        recognition.onresult = handleRecognitionResult;
        recognition.onerror = handleRecognitionError;
        recognition.onend = handleRecognitionEnd;
        
        // Start recognition
        recognition.start();
        
    } catch (error) {
        console.error('Error starting speech recognition:', error);
        appendMessage('system', 'Error starting voice recognition. Please try again.');
        resetVoiceButton();
    }
}

/**
 * Stop voice recognition
 */
function stopVoiceRecognition() {
    if (recognition) {
        recognition.stop();
    }
}

/**
 * Handle recognition start
 */
function handleRecognitionStart() {
    isListening = true;
    updateVoiceButtonState('listening');
    showTemporaryMessage("Listening... Speak now!");
}

/**
 * Handle recognition result
 */
function handleRecognitionResult(event) {
    try {
        const speechResult = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        updateVoiceButtonState('processing');
        
        if (confidence > 0.5 || confidence === undefined) {
            // Set the input value and send the message
            chatInput.value = speechResult;
            
            setTimeout(() => {
                handleSendMessage();
            }, 500);
        } else {
            showTemporaryMessage("Sorry, I didn't catch that clearly. Please try again.");
        }
        
    } catch (error) {
        console.error('Error processing speech result:', error);
        appendMessage('system', 'Error processing voice input. Please try again.');
    }
}

/**
 * Handle recognition error
 */
function handleRecognitionError(event) {
    console.error('Speech recognition error:', event.error);
    
    let errorMessage = 'Voice recognition error. ';
    
    switch (event.error) {
        case 'no-speech':
            errorMessage += 'No speech detected. Please try again.';
            break;
        case 'audio-capture':
            errorMessage += 'Microphone not accessible. Please check permissions.';
            break;
        case 'not-allowed':
            errorMessage += 'Microphone permission denied. Please allow microphone access.';
            break;
        case 'network':
            errorMessage += 'Network error. Please check your connection.';
            break;
        default:
            errorMessage += 'Please try again.';
    }
    
    showTemporaryMessage(errorMessage);
    resetVoiceButton();
}

/**
 * Handle recognition end
 */
function handleRecognitionEnd() {
    isListening = false;
    
    setTimeout(() => {
        if (!isProcessing) {
            resetVoiceButton();
        }
    }, 500);
}

/**
 * Update voice button visual state
 */
function updateVoiceButtonState(state) {
    const icon = voiceInputBtn.querySelector('i');
    
    // Remove all state classes
    voiceInputBtn.classList.remove('btn-listening', 'btn-processing');
    
    switch (state) {
        case 'listening':
            voiceInputBtn.classList.add('btn-listening');
            icon.className = 'fas fa-microphone-alt fs-5';
            voiceInputBtn.title = 'Listening... Click to stop';
            break;
        case 'processing':
            voiceInputBtn.classList.add('btn-processing');
            icon.className = 'fas fa-cog fa-spin fs-5';
            voiceInputBtn.title = 'Processing...';
            break;
        default:
            resetVoiceButton();
    }
}

/**
 * Reset voice button to default state
 */
function resetVoiceButton() {
    const icon = voiceInputBtn.querySelector('i');
    voiceInputBtn.classList.remove('btn-listening', 'btn-processing');
    icon.className = 'fas fa-microphone fs-5';
    voiceInputBtn.title = 'Click to use voice input';
}

/**
 * Show a temporary message
 */
function showTemporaryMessage(message) {
    // Remove any existing temporary messages
    const existingTemp = chatMessages.querySelector('.temp-message');
    if (existingTemp) {
        existingTemp.remove();
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.className = 'temp-message';
    tempDiv.textContent = message;
    
    chatMessages.appendChild(tempDiv);
    
    // Remove after animation completes
    setTimeout(() => {
        if (tempDiv.parentNode) {
            tempDiv.remove();
        }
    }, 3000);
}

// Handle browser compatibility and cleanup
window.addEventListener('beforeunload', function() {
    if (recognition) {
        recognition.stop();
    }
});

// Handle visibility change to stop recognition if page becomes hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden && isListening) {
        stopVoiceRecognition();
    }
});
