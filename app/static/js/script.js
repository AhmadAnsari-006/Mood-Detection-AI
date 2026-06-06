let currentUser = null;
let currentPredictionId = null;
let recognition = null;
let isRecording = false;

// 🤖 Core Mood Analysis Function
async function analyzeMood() {
    const text = document.getElementById("text-input").value;
    const loader = document.getElementById("loader");
    const resultBox = document.getElementById("result-box");
    const typingText = document.getElementById("typing-text");

    if (text.trim() === "") {
        alert("Please enter some text!");
        return;
    }

    loader.classList.remove("hidden");
    resultBox.classList.add("hidden");
    typingText.innerText = "";
    currentPredictionId = null;

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();
        
        loader.classList.add("hidden");
        resultBox.classList.remove("hidden");

        if (response.ok) {
            const mood = data.mood;
            const confidence = data.confidence;
            currentPredictionId = data.id || null;

            const moodEmojis = {
                "happy": "😊",
                "sad": "😢",
                "angry": "😠",
                "neutral": "😐",
                "joy": "😊",
                "fear": "😨",
                "surprise": "😲",
                "disgust": "🤢",
                "love": "❤️"
            };
            
            const emoji = moodEmojis[mood.toLowerCase()] || "🤔";
            const capitalizedMood = mood.charAt(0).toUpperCase() + mood.slice(1);
            
            let aiResponse = `Analyzing emotional tone...\n\nDetected Mood: ${capitalizedMood} ${emoji}`;
            if (confidence !== undefined) {
                aiResponse += `\nConfidence Score: ${confidence}%`;
            }
            
            typeText(aiResponse, typingText, 30);

            // Handle showing correct feedback sections
            const feedbackPanel = document.getElementById("feedback-panel");
            const anonPrompt = document.getElementById("anonymous-feedback-prompt");
            const corrSelectContainer = document.getElementById("correction-select-container");
            
            corrSelectContainer.classList.add("hidden"); // reset dropdown
            
            if (currentUser && currentUser.role === "meta-user") {
                feedbackPanel.classList.remove("hidden");
                anonPrompt.classList.add("hidden");
            } else if (currentUser) {
                // Logged in as user/developer (cannot submit feedback)
                feedbackPanel.classList.add("hidden");
                anonPrompt.classList.add("hidden");
            } else {
                feedbackPanel.classList.add("hidden");
                anonPrompt.classList.remove("hidden");
            }
        } else {
            typeText(`Error: ${data.error || "Failed to analyze mood"}`, typingText, 30);
        }
    } catch (error) {
        loader.classList.add("hidden");
        resultBox.classList.remove("hidden");
        typeText("Error: Failed to connect to the server.", typingText, 30);
    }
}

// 🤖 AI Typing Effect
function typeText(text, element, speed) {
    let i = 0;
    element.innerHTML = "";

    function typing() {
        if (i < text.length) {
            if (text.charAt(i) === '\n') {
                element.innerHTML += '<br>';
            } else {
                element.innerHTML += text.charAt(i);
            }
            i++;
            setTimeout(typing, speed);
        }
    }

    typing();
}

// 📂 Client-Side File Upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        document.getElementById("text-input").value = text;
    };
    reader.readAsText(file);
}

// 👁️ Password Visibility Toggle
function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    const icon = btnEl.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fas fa-eye-slash";
        btnEl.title = "Hide password";
    } else {
        input.type = "password";
        icon.className = "fas fa-eye";
        btnEl.title = "Show password";
    }
}

// 🎤 WebSpeech API integration
let micAutoStopTimer = null;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            document.getElementById("text-input").value = transcript;
            
            // Reset auto-stop timer on each new result
            resetMicAutoStop();
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === "no-speech") {
                // Quietly restart if no speech detected
                if (isRecording) {
                    try { recognition.start(); } catch(e) {}
                }
                return;
            }
            stopRecording();
        };

        recognition.onend = () => {
            if (isRecording) {
                try { recognition.start(); } catch(e) {}
            }
        };
    }
}

function resetMicAutoStop() {
    if (micAutoStopTimer) clearTimeout(micAutoStopTimer);
    micAutoStopTimer = setTimeout(() => {
        if (isRecording) {
            stopRecording();
        }
    }, 60000); // Auto-stop after 60 seconds of no new speech
}

function toggleSpeechRecording() {
    if (!recognition) {
        initSpeechRecognition();
    }
    if (!recognition) {
        alert("Speech Recognition API is not supported in this browser.");
        return;
    }
    
    const micBtn = document.getElementById("mic-btn");
    const micStatus = document.getElementById("mic-status");
    
    if (!isRecording) {
        isRecording = true;
        recognition.start();
        micBtn.classList.add("recording");
        micStatus.classList.remove("hidden");
        resetMicAutoStop();
    } else {
        stopRecording();
    }
}

function stopRecording() {
    isRecording = false;
    if (micAutoStopTimer) {
        clearTimeout(micAutoStopTimer);
        micAutoStopTimer = null;
    }
    if (recognition) {
        recognition.stop();
    }
    const micBtn = document.getElementById("mic-btn");
    const micStatus = document.getElementById("mic-status");
    
    micBtn.classList.remove("recording");
    micStatus.classList.add("hidden");
}

// 🔒 Session & Auth UI Updates
async function checkSession() {
    try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                currentUser = data.user;
                updateAuthUI();
                // Redirect immediately to prediction page
                document.getElementById("startup-screen").classList.add("hidden");
                document.getElementById("app-screen").classList.remove("hidden");
                return;
            }
        }
    } catch (e) {
        console.log("No active session.");
    }
    currentUser = null;
    updateAuthUI();
    // Return to startup screen
    document.getElementById("app-screen").classList.add("hidden");
    document.getElementById("startup-screen").classList.remove("hidden");
}

function updateAuthUI() {
    const sessionUserInfo = document.getElementById("session-user-info");
    const micBtn = document.getElementById("mic-btn");

    if (currentUser) {
        sessionUserInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUser.fullName} (${currentUser.role})`;
        sessionUserInfo.classList.remove("hidden");

        // Microphone visible ONLY for meta-user and developer (admin developer)
        if (currentUser.role === "meta-user" || currentUser.role === "developer") {
            micBtn.classList.remove("hidden");
        } else {
            micBtn.classList.add("hidden");
        }
    } else {
        sessionUserInfo.classList.add("hidden");
        micBtn.classList.add("hidden");
        stopRecording();
    }
}

// View and Form Toggling
function showAuthCard(mode) {
    const signinContainer = document.getElementById("startup-signin-container");
    const signupContainer = document.getElementById("startup-signup-container");
    
    if (mode === "signin") {
        signinContainer.classList.remove("hidden");
        signupContainer.classList.add("hidden");
    } else {
        signinContainer.classList.add("hidden");
        signupContainer.classList.remove("hidden");
    }
}

function handleGuestLogin() {
    currentUser = null;
    updateAuthUI();
    document.getElementById("startup-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    
    // Reset feedback sections
    document.getElementById("feedback-panel").classList.add("hidden");
    document.getElementById("anonymous-feedback-prompt").classList.add("hidden");
}

function returnToStartup() {
    stopRecording();
    document.getElementById("app-screen").classList.add("hidden");
    document.getElementById("startup-screen").classList.remove("hidden");
    showAuthCard("signin");
}

// Auth Action Handlers
async function handleSignin(event) {
    event.preventDefault();
    const username = document.getElementById("signin-username").value.trim();
    const password = document.getElementById("signin-password").value;
    
    try {
        const response = await fetch("/api/auth/signin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username: username, password: password })
        });
        
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            updateAuthUI();
            
            // Switch view
            document.getElementById("startup-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            
            // Clean forms
            document.getElementById("signin-username").value = "";
            document.getElementById("signin-password").value = "";
            
            alert(`Welcome back, ${currentUser.fullName}!`);
        } else {
            alert(`Error: ${data.error || "Invalid credentials"}`);
        }
    } catch (e) {
        alert("Failed to connect to server for authentication.");
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const fullName = document.getElementById("signup-fullname").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    
    try {
        const response = await fetch("/api/auth/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ fullName, username, email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            updateAuthUI();
            
            // Switch view
            document.getElementById("startup-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            
            // Clean forms
            document.getElementById("signup-fullname").value = "";
            document.getElementById("signup-username").value = "";
            document.getElementById("signup-email").value = "";
            document.getElementById("signup-password").value = "";
            
            alert(`Account registered! Welcome, ${currentUser.fullName}!`);
        } else {
            alert(`Error: ${data.error || "Failed to register"}`);
        }
    } catch (e) {
        alert("Failed to connect to server for registration.");
    }
}

async function handleLogout() {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST"
        });
        if (response.ok) {
            currentUser = null;
            updateAuthUI();
            returnToStartup();
            alert("Logged out successfully.");
        }
    } catch (e) {
        alert("Error logging out.");
    }
}

// 🤝 Feedback logic
function showCorrectionSelect() {
    document.getElementById("correction-select-container").classList.remove("hidden");
}

async function submitFeedback(correct) {
    if (!currentPredictionId) return;
    
    let payload = {
        predictionId: currentPredictionId,
        correct: correct
    };
    
    if (!correct) {
        const correctEmotionSelect = document.getElementById("correct-emotion-select");
        payload.correctEmotion = correctEmotionSelect.value;
    }
    
    try {
        const response = await fetch("/api/feedback/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok) {
            alert("Thank you for your feedback! It has been successfully saved.");
            document.getElementById("feedback-panel").classList.add("hidden");
        } else {
            alert(`Error: ${data.error || "Failed to submit feedback"}`);
        }
    } catch (e) {
        alert("Failed to connect to the server to submit feedback.");
    }
}

// 🌓 Theme toggling logic
function toggleTheme() {
    const htmlElement = document.documentElement;
    const themeIcon = document.querySelector("#theme-toggle-btn i");
    
    if (htmlElement.classList.contains("light-theme")) {
        htmlElement.classList.remove("light-theme");
        localStorage.setItem("theme", "dark");
        if (themeIcon) {
            themeIcon.className = "fas fa-sun";
        }
    } else {
        htmlElement.classList.add("light-theme");
        localStorage.setItem("theme", "light");
        if (themeIcon) {
            themeIcon.className = "fas fa-moon";
        }
    }
}

// Check session and theme on page load
window.addEventListener("DOMContentLoaded", () => {
    // Apply saved theme preference
    const savedTheme = localStorage.getItem("theme") || "dark";
    const htmlElement = document.documentElement;
    const themeIcon = document.querySelector("#theme-toggle-btn i");
    
    if (savedTheme === "light") {
        htmlElement.classList.add("light-theme");
        if (themeIcon) {
            themeIcon.className = "fas fa-moon";
        }
    } else {
        htmlElement.classList.remove("light-theme");
        if (themeIcon) {
            themeIcon.className = "fas fa-sun";
        }
    }
    
    checkSession();
});