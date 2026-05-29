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
            const moodEmojis = {
                "happy": "😊",
                "sad": "😢",
                "angry": "😠",
                "neutral": "😐",
                "joy": "😊",
                "fear": "😨",
                "surprise": "😲",
                "disgust": "🤢"
            };
            
            // Map the emoji if it exists, otherwise use a default
            const emoji = moodEmojis[mood.toLowerCase()] || "🤔";
            
            // Capitalize first letter of mood
            const capitalizedMood = mood.charAt(0).toUpperCase() + mood.slice(1);
            
            const aiResponse = `Analyzing emotional tone...\n\nDetected Mood: ${capitalizedMood} ${emoji}`;
            typeText(aiResponse, typingText, 30);
        } else {
            typeText(`Error: ${data.error || "Failed to analyze mood"}`, typingText, 30);
        }
    } catch (error) {
        loader.classList.add("hidden");
        resultBox.classList.remove("hidden");
        typeText("Error: Failed to connect to the server.", typingText, 30);
    }
}

/* 🤖 AI Typing Effect */
function typeText(text, element, speed) {
    let i = 0;
    element.innerHTML = "";

    function typing() {
        if (i < text.length) {
            // Replace newlines with <br> for HTML
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