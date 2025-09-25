// DOM element references and global variables
let chatInput, sendBtn, chatMessages, voiceInputBtn, initialWelcome;
let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let isListening = false;
let isRecording = false;
let isProcessing = false;
let currentAudio = null;
let silenceTimer = null;
let recordingTimeout = null;

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

        // Don't send if already processing or listening/recording
        if (isListening || isRecording || isProcessing) {
            return;
        }

        handleSendMessage();
    }
}

/**
 * Handle sending a message (text input)
 */
async function handleSendMessage() {
    const message = chatInput.value.trim();

    if (!message) {
        return;
    }

    // Prevent multiple sends
    if (isProcessing) {
        return;
    }

    isProcessing = true;
    stopAudioPlayback(); // Stop any currently playing audio

    // Add user message
    appendMessage('user', message);

    // Clear input
    chatInput.value = '';

    try {
        // Send message to Flask backend as FormData (for consistency)
        const formData = new FormData();
        formData.append('message', message);
        formData.append('userId', getOrCreateUserId());

        const response = await fetch('/chat', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const botResponseText = data.response;
        const userAudioUrl = data.user_audio_url;
        const botAudioUrl = data.bot_audio_url;

        appendMessage('bot', botResponseText); // Display text response

        // Play bot audio response
        if (botAudioUrl) {
            playAudio(botAudioUrl);
        }

    } catch (error) {
        console.error('Error sending message to backend:', error);
        appendMessage('bot', "Sorry, I'm having trouble connecting right now. Please try again later.");
    } finally {
        isProcessing = false;
        chatInput.focus();
    }
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

    messageDiv.innerHTML = formatMultilineText(text);

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
 * Format multiline text with bullet points and links
 */
function formatMultilineText(text) {
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

    return text
        .split('\n')
        .map(line => {
            // Handle bullet points
            if (line.trim().startsWith('- ')) {
                line = '&nbsp;&nbsp;&bull;&nbsp;' + line.trim().substring(2);
            }

            // Replace ONLY markdown [text](url) with an anchor tag
            line = line.replace(markdownLinkRegex, (match, text, url) => {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            });

            return line;
        })
        .join('<br>');
}

/**
 * Play audio from a given URL (returns a promise)
 */
function playAudio(url) {
    return new Promise((resolve, reject) => {
        stopAudioPlayback(); // Stop any previous audio
        currentAudio = new Audio(url);
        
        currentAudio.onended = () => {
            resolve();
        };
        
        currentAudio.onerror = (error) => {
            console.error("Error playing audio:", error);
            reject(error);
        };
        
        currentAudio.play().catch(e => {
            console.error("Error playing audio:", e);
            reject(e);
        });
    });
}

/**
 * Stop any currently playing audio
 */
function stopAudioPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}

/**
 * Get or create a unique user ID for session tracking
 */
function getOrCreateUserId() {
    let userId = localStorage.getItem('stu_chatbot_userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('stu_chatbot_userId', userId);
    }
    return userId;
}

/**
 * Check if speech recognition is supported
 */
function checkSpeechRecognitionSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasMediaRecorder = !!window.MediaRecorder;

    if (!SpeechRecognition || !hasMediaRecorder) {
        voiceInputBtn.style.opacity = '0.5';
        voiceInputBtn.title = 'Voice recording not supported in this browser';
        return false;
    }

    voiceInputBtn.title = 'Click to use voice input';
    return true;
}

/**
 * Handle voice input button click
 */
function handleVoiceInput() {
    // If already recording, stop
    if (isRecording) {
        stopVoiceRecording();
        return;
    }

    // If processing, don't start new recording
    if (isProcessing) {
        showTemporaryMessage("Please wait for the current message to be processed.");
        return;
    }

    startVoiceRecording();
}

/**
 * Start voice recording with actual audio capture
 */
async function startVoiceRecording() {
    try {
        // Clear any existing timers
        clearTimers();

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processRecordedAudio(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        // Start speech recognition for text transcription
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true; // Enable interim results for silence detection
        recognition.maxAlternatives = 1;
        recognition.continuous = true; // Keep listening until stopped

        let finalTranscript = '';
        let silenceStartTime = null;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let newFinalText = false;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                    newFinalText = true;
                    // Reset silence timer when we get final text
                    resetSilenceTimer();
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update input with both final and interim results
            if (finalTranscript || interimTranscript) {
                chatInput.value = finalTranscript + interimTranscript;
            }

            // If we got new final text, user is still speaking
            if (newFinalText) {
                resetSilenceTimer();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // No speech detected, stop recording after short delay
                setTimeout(() => {
                    if (isRecording) {
                        stopVoiceRecording();
                    }
                }, 2000);
            }
        };

        recognition.onend = () => {
            console.log("Speech recognition ended");
            // If we're still recording, restart speech recognition
            if (isRecording) {
                setTimeout(() => {
                    if (isRecording && recognition) {
                        recognition.start();
                    }
                }, 100);
            }
        };

        // Start both recording and recognition
        mediaRecorder.start(1000); // Collect data every second
        recognition.start();
        isRecording = true;
        isListening = true;
        
        updateVoiceButtonState('recording');
        showTemporaryMessage("Recording... Speak now!");

        // Set up silence detection timer
        resetSilenceTimer();

        // Set maximum recording time (30 seconds)
        recordingTimeout = setTimeout(() => {
            if (isRecording) {
                showTemporaryMessage("Maximum recording time reached.");
                stopVoiceRecording();
            }
        }, 30000);

    } catch (error) {
        console.error('Error starting recording:', error);
        
        if (error.name === 'NotAllowedError') {
            appendMessage('system', 'Microphone permission denied. Please allow microphone access to use voice input.');
        } else if (error.name === 'NotFoundError') {
            appendMessage('system', 'No microphone found. Please check your audio devices.');
        } else {
            appendMessage('system', 'Error accessing microphone. Please try again.');
        }
        
        resetVoiceButton();
    }
}

/**
 * Reset silence detection timer
 */
function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    
    // Stop recording after 2 seconds of silence
    silenceTimer = setTimeout(() => {
        if (isRecording) {
            console.log("Silence detected, stopping recording");
            stopVoiceRecording();
        }
    }, 2000);
}

/**
 * Clear all timers
 */
function clearTimers() {
    clearTimeout(silenceTimer);
    clearTimeout(recordingTimeout);
    silenceTimer = null;
    recordingTimeout = null;
}

/**
 * Stop voice recording
 */
function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        console.log("Stopping voice recording");
        clearTimers();
        
        mediaRecorder.stop();
        if (recognition) {
            recognition.stop();
        }
        isRecording = false;
        isListening = false;
        updateVoiceButtonState('processing');
        showTemporaryMessage("Processing your voice message...");
    }
}

/**
 * Process the recorded audio and send to backend
 */
async function processRecordedAudio(audioBlob) {
    try {
        const speechResult = chatInput.value.trim();
        
        if (!speechResult) {
            showTemporaryMessage("No speech detected. Please try again.");
            resetVoiceButton();
            return;
        }

        console.log("Sending voice message:", speechResult);
        console.log("Audio blob size:", audioBlob.size, "bytes");

        // Send message with actual voice audio
        await sendMessageWithVoice(speechResult, audioBlob);

    } catch (error) {
        console.error('Error processing recorded audio:', error);
        appendMessage('system', 'Error processing voice recording. Please try again.');
        resetVoiceButton();
    }
}

/**
 * Send message with actual voice audio
 */
async function sendMessageWithVoice(message, audioBlob) {
    if (!message) {
        showTemporaryMessage("No message to send.");
        resetVoiceButton();
        return;
    }

    isProcessing = true;
    stopAudioPlayback();

    // Add user message
    appendMessage('user', message);

    // Clear input
    chatInput.value = '';

    try {
        // Create FormData to send both text and audio
        const formData = new FormData();
        formData.append('message', message);
        formData.append('userId', getOrCreateUserId());
        
        if (audioBlob && audioBlob.size > 0) {
            // Convert webm to wav for better compatibility
            const wavBlob = await convertWebmToWav(audioBlob);
            formData.append('voice_audio', wavBlob, 'user_voice.wav');
        }

        // Send to backend
        const response = await fetch('/chat', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const botResponseText = data.response;
        const userAudioUrl = data.user_audio_url;
        const botAudioUrl = data.bot_audio_url;

        appendMessage('bot', botResponseText);

        // Play user's actual voice first, then bot response
        if (userAudioUrl) {
            await playAudio(userAudioUrl);
        }
        
        if (botAudioUrl) {
            playAudio(botAudioUrl);
        }

    } catch (error) {
        console.error('Error sending voice message:', error);
        appendMessage('bot', "Sorry, I'm having trouble connecting right now. Please try again later.");
    } finally {
        isProcessing = false;
        resetVoiceButton();
        chatInput.focus();
    }
}

/**
 * Convert WebM blob to WAV blob for better compatibility
 */
async function convertWebmToWav(webmBlob) {
    try {
        // For simplicity, we'll return the original blob
        // In a production environment, you might want to use a proper conversion library
        return webmBlob;
    } catch (error) {
        console.error('Error converting WebM to WAV:', error);
        return webmBlob;
    }
}

/**
 * Update voice button visual state
 */
function updateVoiceButtonState(state) {
    const icon = voiceInputBtn.querySelector('i');

    // Remove all state classes
    voiceInputBtn.classList.remove('btn-listening', 'btn-processing', 'btn-recording');

    switch (state) {
        case 'recording':
            voiceInputBtn.classList.add('btn-recording');
            icon.className = 'fas fa-microphone-alt fs-5';
            voiceInputBtn.title = 'Recording... Click to stop';
            voiceInputBtn.style.color = '#dc3545';
            break;
        case 'processing':
            voiceInputBtn.classList.add('btn-processing');
            icon.className = 'fas fa-cog fa-spin fs-5';
            voiceInputBtn.title = 'Processing...';
            voiceInputBtn.style.color = '';
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
    voiceInputBtn.classList.remove('btn-listening', 'btn-processing', 'btn-recording');
    icon.className = 'fas fa-microphone fs-5';
    voiceInputBtn.title = 'Click to use voice input';
    voiceInputBtn.style.color = '';
    isRecording = false;
    isListening = false;
    clearTimers();
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

    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);

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
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
    stopAudioPlayback();
    clearTimers();
});

// Handle visibility change to stop recording if page becomes hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (isRecording) {
            stopVoiceRecording();
        }
        stopAudioPlayback();
        clearTimers();
    }
});

// Handle page unload cleanup
window.addEventListener('unload', function() {
    if (recognition) {
        recognition.stop();
    }
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
    clearTimers();
});