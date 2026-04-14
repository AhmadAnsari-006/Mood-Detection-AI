function analyzeMood() {
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

    // Simulate real-time prediction delay
    setTimeout(() => {
        loader.classList.add("hidden");
        resultBox.classList.remove("hidden");

        const moods = ["Happy 😊", "Sad 😢", "Angry 😠", "Neutral 😐"];
        const mood = moods[Math.floor(Math.random() * moods.length)];

        const response = `Analyzing emotional tone...\n\nDetected Mood: ${mood}`;

        typeText(response, typingText, 30);

    }, 1000);
}

/* 🤖 AI Typing Effect */
function typeText(text, element, speed) {
    let i = 0;
    element.innerHTML = "";

    function typing() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(typing, speed);
        }
    }

    typing();
}