const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const newChat = document.getElementById("newChat");
const headerNewChat = document.getElementById("headerNewChat");
const clearBtn = document.getElementById("clearBtn");
const themeBtn = document.getElementById("themeBtn");

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");


// ================= CHAT MEMORY =================

let conversation = [];


// ================= SEND MESSAGE =================

async function sendMessage(text = null) {
    // सजेशन बटनबाट आएको टेक्स्ट वा इनपुट बक्सको टेक्स्ट लिने र अतिरिक्त स्पेस हटाउने
    const message = text || input.value.trim();

    if (!message) return;

    input.value = "";
    input.style.height = "auto";

    const welcome = document.querySelector(".welcome");
    if (welcome) {
        welcome.remove();
    }

    // User message
    addMessage("user", message);

    // Save user message
    conversation.push({
        role: "user",
        content: message
    });

    // Typing indicator
    showTyping();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: conversation
            })
        });

        const data = await response.json();
        removeTyping();

        if (!response.ok) {
            throw new Error(data.error || "AI request failed.");
        }

        const answer = data.answer;

        // Save AI answer
        conversation.push({
            role: "assistant",
            content: answer
        });

        // Display AI answer
        addMessage("ai", answer);

    } catch (error) {
        removeTyping();
        console.error(error);
        addMessage(
            "ai",
            "❌ Sorry, AI response आएन।\n\nServer चलिरहेको छ कि छैन र API key सही छ कि छैन जाँच गर्नुहोस्।"
        );
    }
}


// ================= ADD MESSAGE =================

function addMessage(type, text) {
    const message = document.createElement("div");
    message.className = "message";

    const avatar = document.createElement("div");
    avatar.className = "avatar " + (type === "user" ? "user-avatar" : "ai-avatar");
    avatar.textContent = type === "user" ? "👤" : "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = type === "user" ? "You" : "Nishchal AI";

    const textDiv = document.createElement("div");
    textDiv.textContent = text;

    content.appendChild(name);
    content.appendChild(textDiv);

    // Copy button for AI messages
    if (type === "ai") {
        const copy = document.createElement("button");
        copy.className = "copy-btn";
        copy.textContent = "📋 Copy";

        copy.onclick = async () => {
            try {
                await navigator.clipboard.writeText(text);
                copy.textContent = "✓ Copied";
                setTimeout(() => {
                    copy.textContent = "📋 Copy";
                }, 1500);
            } catch {
                copy.textContent = "Copy failed";
            }
        };

        content.appendChild(copy);
    }

    message.appendChild(avatar);
    message.appendChild(content);
    chat.appendChild(message);

    scrollToBottom();
}


// ================= AUTO SCROLL =================

function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
}


// ================= TYPING =================

function showTyping() {
    const typing = document.createElement("div");
    typing.className = "message";
    typing.id = "typingMessage";

    typing.innerHTML = `
        <div class="avatar ai-avatar">
            🤖
        </div>
        <div class="message-content">
            <div class="message-name">
                Nishchal AI
            </div>
            <div class="typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    chat.appendChild(typing);
    scrollToBottom();
}


function removeTyping() {
    const typing = document.getElementById("typingMessage");
    if (typing) {
        typing.remove();
    }
}


// ================= NEW CHAT =================

function startNewChat() {
    conversation = [];

    chat.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">
                🤖
            </div>
            <h1>
                Hello! I'm Nishchal AI
            </h1>
            <p>
                Ask me anything. I can help with
                computers, programming, networking,
                school questions and much more.
            </p>
            <div class="suggestions">
                <button class="suggestion">💻 How does a computer work?</button>
                <button class="suggestion">👨‍💻 Explain JavaScript</button>
                <button class="suggestion">📶 Why is my WiFi slow?</button>
                <button class="suggestion">🐍 Teach me Python</button>
            </div>
        </div>
    `;

    addSuggestionEvents();
}


// ================= CLEAR CHAT =================

clearBtn.addEventListener("click", () => {
    conversation = [];
    chat.innerHTML = "";
});


// ================= DARK / LIGHT MODE =================

themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light"); // यदि तपाईंको CSS मा body.light छ भने

    if (document.body.classList.contains("light")) {
        themeBtn.textContent = "🌙 Dark Mode";
    } else {
        themeBtn.textContent = "☀️ Light Mode";
    }
});


// ================= SEND BUTTON =================

sendBtn.addEventListener("click", () => {
    sendMessage();
});


// ================= ENTER KEY =================

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});


// ================= TEXTAREA AUTO HEIGHT =================

input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
});


// ================= NEW CHAT EVENTS =================

newChat.addEventListener("click", startNewChat);
if (headerNewChat) {
    headerNewChat.addEventListener("click", startNewChat);
}


// ================= MOBILE MENU =================

menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});


// ================= SUGGESTIONS =================

function addSuggestionEvents() {
    document.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            // बटनमा भएको इमोजी वा अतिरिक्त स्पेस हटाएर शुद्ध टेक्स्ट पठाउन
            const text = button.textContent.replace(/^[^\w\s]+/, "").trim();
            sendMessage(text);
        });
    });
}

// Initial call
addSuggestionEvents();
