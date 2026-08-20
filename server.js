import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// INITIALIZE GEMINI
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(bodyParser.json({ limit: "15mb" }));
app.use(express.static(__dirname));

const VERIFY_TOKEN = "nischal_bot_verify_token_2026";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const WEATHERSTACK_API_KEY = process.env.WEATHERSTACK_API_KEY;

// ==========================================
// AI ON / OFF CONTROL
// ==========================================
const AI_ENABLED = process.env.AI_ENABLED !== "false";

// ==========================================
// CHAT SESSIONS STORAGE
// ==========================================
const messengerSessions = new Map();

// ==========================================
// NISCHAL AI SYSTEM INSTRUCTIONS
// ==========================================
const AI_INSTRUCTIONS = `
You are Nischal AI, a helpful, intelligent technical AI assistant created by Nischal Nepal.

STRICT FORMATTING & STYLE RULES:
1. EMOJI RULE: Always use relevant, expressive emojis naturally in your response according to the context of the conversation.
2. LANGUAGE RULE: Speak primarily in clear Nepali. Mix English only when necessary (keep English usage very minimal).
3. TEXT STYLE: NEVER use asterisks (**) or markdown formatting for bolding text. Write plain text without any stars.
4. Keep answers friendly, engaging, clear, and easy to understand.

==================================================
CREATOR RULE
==================================================
ONLY when the user specifically asks questions like:
"तिमीलाई कसले बनाएको?"
"तिमीलाई कसले बनायो?"
"तपाईंलाई कसले बनाएको?"
"Who created you?"
"Who made you?"
"Who coded you?"
"Who is your creator?"

Answer:
"मलाई निश्चल नेपालले coding गरेर बनाउनुभएको हो 👨‍💻✨."

IMPORTANT:
Do NOT mention Nischal Nepal as your creator in normal answers.
Only say it when the user asks who created, made or coded you.

==================================================
ABOUT NISCHAL NEPAL
==================================================
If the user specifically asks about Nishchal Nepal, use ONLY this information:
निश्चल नेपाल Nischal AI लाई coding गरेर बनाउने व्यक्ति हुनुहुन्छ 💻।
उहाँका बाबाको नाम गङ्गाप्रसाद नेपाल हो।
उहाँकी आमाको नाम कमला नेपाल हो।
उहाँकी दिदीको नाम सुस्मिता नेपाल हो।
उहाँकी अर्को दिदीको नाम अनशिका नेपाल हो।
उहाँका बाबा शिक्षक तथा प्रधानाध्यापक हुनुहुन्छ 👨‍🏫।

==================================================
ABOUT AISHAN KARKI
==================================================
If the user asks about Aishan Karki, use ONLY this information:
Aishan Karki निश्चल नेपालको साथी हुनुहुन्छ 🤝।
उहाँ कक्षा १२ मा पढ्दै हुनुहुन्छ 📚।
उहाँ १५ वर्षको हुनुहुन्छ।
उहाँको favorite game Free Fire हो 🎮।
उहाँ Free Fire मा एकदमै talented हुनुहुन्छ।
उहाँको favorite football player Cristiano Ronaldo हो ⚽।
उहाँको घर फलेलुङ–२, जोडपाटी हो 🏡।
उहाँ पढाइमा पनि एकदमै talented हुनुहुन्छ।
`;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getAIModel() {
    return genAI.getGenerativeModel({
        model: "gemini-3.5-flash-lite",
        systemInstruction: AI_INSTRUCTIONS
    });
}

// ==========================================
// 1. LIVE WEATHER (Using wttr.in - Super Fast & Accurate)
// ==========================================

async function getLiveWeather(userMessage) {
    try {
        let city = "Birtamode"; // Default to Birtamode as requested
        const text = userMessage.toLowerCase();
        
        const cities = ["birtamode", "बिर्तामोड", "jhapa", "झापा", "ilam", "इलाम", "pokhara", "पोखरा", "biratnagar", "विराटनगर", "kathmandu", "काठमाडौं", "lalitpur", "ललितपुर", "bhaktapur", "भक्तपुर", "dharan", "धरान", "butwal", "बुटवल", "chitwan", "चितवन", "hetauda", "हेटौंडा"];
        
        for (let c of cities) {
            if (text.includes(c)) {
                city = c;
                break;
            }
        }

        const response = await axios.get(
            `https://wttr.in/${encodeURIComponent(city)}?format=3`,
            { timeout: 5000 }
        );

        if (response.status === 200 && response.data) {
            return `हालको मौसम (${city}): ${response.data.trim()} 🌤️`;
        }

        return "अहिले मौसमको जानकारी फेला पार्न सकिएन 🌦️।";
    } catch (e) {
        console.error("Weather Error:", e.message);
        return "मौसमको जानकारी ल्याउँदा समस्या भयो 🌦️।";
    }
}

// ==========================================
// 2. ADVANCED WEB SEARCH / TODAY'S NEWS (Using Gemini Google Search Tool)
// ==========================================

async function searchWeb(query) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3.5-flash-lite",
            tools: [{ googleSearch: {} }],
            systemInstruction: AI_INSTRUCTIONS
        });

        const result = await model.generateContent(`Provide today's latest news or accurate information in clear Nepali for: ${query}`);
        return result.response.text();
    } catch (e) {
        console.error("Web Search Error:", e.message);
        return null;
    }
}

// ==========================================
// URL → GEMINI FILE
// ==========================================

async function urlToGenerativePart(url, mimeType) {
    const response = await axios.get(url, {
        responseType: "arraybuffer"
    });

    return {
        inlineData: {
            data: Buffer.from(response.data).toString("base64"),
            mimeType
        }
    };
}

// ==========================================
// WEBSITE CHAT API ENDPOINT
// ==========================================
app.post("/api/chat", async (req, res) => {
    try {
        if (!AI_ENABLED) {
            return res.status(403).json({ error: "Nischal AI is currently OFF." });
        }

        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Invalid messages format" });
        }

        const latestMessage = messages[messages.length - 1].content;
        const lowerMsg = latestMessage.toLowerCase();

        // 1. DYNAMIC WEATHER CHECK
        if (lowerMsg.includes("मौसम") || lowerMsg.includes("weather") || lowerMsg.includes("तापक्रम")) {
            const weather = await getLiveWeather(latestMessage);
            if (weather) {
                return res.json({ answer: weather });
            }
        }

        // 2. NEWS OR WEB SEARCH CHECK
        if (lowerMsg.includes("news") || lowerMsg.includes("न्युज") || lowerMsg.includes("समाचार") || lowerMsg.includes("प्रधानमन्त्री") || lowerMsg.includes("pm") || lowerMsg.includes("आज") || lowerMsg.includes("तथ्य") || lowerMsg.includes("search")) {
            const searchResult = await searchWeb(latestMessage);
            if (searchResult) {
                return res.json({ answer: searchResult });
            }
        }

        // 3. NORMAL AI CHAT
        const model = getAIModel();
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
        }));

        const chatSession = model.startChat({ history });
        const result = await chatSession.sendMessage(latestMessage);
        let answer = result.response.text();

        res.json({ answer });

    } catch (error) {
        console.error("Website Chat Error:", error.message);
        res.status(500).json({ error: "AI request failed." });
    }
});

// ==========================================
// FACEBOOK MESSENGER WEBHOOK
// ==========================================

// Webhook Verification (GET)
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Webhook Messages (POST)
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object !== "page") {
        return res.sendStatus(404);
    }

    if (!AI_ENABLED) {
        console.log("🔴 Nischal AI is OFF - message ignored");
        return res.status(200).send("AI_DISABLED");
    }

    for (const entry of body.entry || []) {
        for (const webhookEvent of entry.messaging || []) {
            const sender_psid = webhookEvent.sender.id;

            try {
                if (webhookEvent.message?.attachments) {
                    const attachment = webhookEvent.message.attachments[0];
                    const mediaUrl = attachment.payload.url;

                    if (attachment.type === "image") {
                        const imagePart = await urlToGenerativePart(mediaUrl, "image/jpeg");
                        const model = getAIModel();
                        const result = await model.generateContent([
                            imagePart,
                            "यो फोटोमा के छ वा यसले के देखाउँछ? प्रष्टसँग उत्तर दिनुहोस्।"
                        ]);
                        await sendMessengerMessage(sender_psid, result.response.text());
                    } else if (attachment.type === "audio") {
                        const audioPart = await urlToGenerativePart(mediaUrl, "audio/mp4");
                        const model = getAIModel();
                        const result = await model.generateContent([
                            audioPart,
                            "यो भ्वाइस मेसेजमा के भनिएको छ? त्यसको उत्तर दिनुहोस्।"
                        ]);
                        await sendMessengerMessage(sender_psid, result.response.text());
                    }
                } else if (webhookEvent.message?.text) {
                    const userMessage = webhookEvent.message.text;
                    const lowerMsg = userMessage.toLowerCase();

                    // 1. WEATHER CHECK
                    if (lowerMsg.includes("मौसम") || lowerMsg.includes("weather") || lowerMsg.includes("तापक्रम")) {
                        const weather = await getLiveWeather(userMessage);
                        await sendMessengerMessage(sender_psid, weather || "अहिले मौसम जानकारी उपलब्ध छैन 🌦️。");
                    } 
                    // 2. NEWS OR SEARCH CHECK
                    else if (lowerMsg.includes("news") || lowerMsg.includes("न्युज") || lowerMsg.includes("समाचार") || lowerMsg.includes("प्रधानमन्त्री") || lowerMsg.includes("pm") || lowerMsg.includes("आज") || lowerMsg.includes("तथ्य") || lowerMsg.includes("search")) {
                        const searchResult = await searchWeb(userMessage);
                        if (searchResult) {
                            await sendMessengerMessage(sender_psid, searchResult);
                        } else {
                            if (!messengerSessions.has(sender_psid)) {
                                messengerSessions.set(sender_psid, getAIModel().startChat({ history: [] }));
                            }
                            const chat = messengerSessions.get(sender_psid);
                            const result = await chat.sendMessage(userMessage);
                            await sendMessengerMessage(sender_psid, result.response.text());
                        }
                    } 
                    // 3. NORMAL AI CHAT
                    else {
                        if (!messengerSessions.has(sender_psid)) {
                            messengerSessions.set(sender_psid, getAIModel().startChat({ history: [] }));
                        }
                        const chat = messengerSessions.get(sender_psid);
                        const result = await chat.sendMessage(userMessage);
                        await sendMessengerMessage(sender_psid, result.response.text());
                    }
                }
            } catch (err) {
                console.error("Processing Error:", err?.message || err);
                await sendMessengerMessage(sender_psid, "माफ गर्नुहोला 🙏 यो मेसेज प्रोसेस गर्नमा केही समस्या आयो। फेरि प्रयास गर्नुहोस् 🔄।");
            }
        }
    }

    res.status(200).send("EVENT_RECEIVED");
});

// ==========================================
// SEND MESSAGE TO FACEBOOK
// ==========================================

async function sendMessengerMessage(sender_psid, response_text) {
    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                recipient: { id: sender_psid },
                message: { text: response_text }
            }
        );
    } catch (error) {
        console.error("Error sending message:", error?.response?.data || error.message);
    }
}

// ==========================================
// SERVER STATUS
// ==========================================

app.get("/", (req, res) => {
    res.send(AI_ENABLED ? "🟢 Nischal AI is ONLINE" : "🔴 Nischal AI is OFF");
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nischal AI Server is running on port ${PORT}`);
    console.log(AI_ENABLED ? "🟢 AI STATUS: ON" : "🔴 AI STATUS: OFF");
});
