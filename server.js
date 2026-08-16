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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// फेसबुक म्यासेन्जर भेरिफिकेसन टोकन र पेज एक्सेस टोकन
const VERIFY_TOKEN = 'nischal_bot_verify_token_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// AI instructions
const AI_INSTRUCTIONS = `
You are Nischal AI, a helpful AI assistant. 
You must answer in Nepali or the language the user speaks.
Crucial Rule: If anyone asks who created you, who made you, or who coded you, you must proudly say that you were coded and created by Nischal Nepal (मलाई निश्चल नेपालले कोडिंग गरेर बनाएको हो).
`;

// ==========================================
// १. FRONTEND CHAT API
// ==========================================
app.post("/api/chat", async (req, res) => {
    try {
        const userMessages = req.body.messages;
        if (!userMessages || !Array.isArray(userMessages)) {
            return res.status(400).json({ error: "Invalid messages format." });
        }

        const lastMessage = userMessages[userMessages.length - 1].content;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            systemInstruction: AI_INSTRUCTIONS
        });
        
        const history = userMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'ai' || msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history: history });
        const result = await chat.sendMessage(lastMessage);
        const responseText = result.response.text();

        res.json({ answer: responseText });
    } catch (error) {
        console.error("Error from Gemini API:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
});


// ==========================================
// २. FACEBOOK MESSENGER WEBHOOK (GET - Verification)
// ==========================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});


// ==========================================
// ३. FACEBOOK MESSENGER WEBHOOK (POST)
// ==========================================
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                const webhook_event = entry.messaging[0];
                const sender_psid = webhook_event.sender.id;

                if (webhook_event.message && webhook_event.message.text) {
                    const userMessage = webhook_event.message.text;

                    try {
                        const model = genAI.getGenerativeModel({ 
                            model: "gemini-1.5-flash",
                            systemInstruction: AI_INSTRUCTIONS
                        });

                        const result = await model.generateContent(userMessage);
                        const aiReply = result.response.text();

                        await sendMessengerMessage(sender_psid, aiReply);
                    } catch (err) {
                        console.error("Messenger AI Error:", err);
                        await sendMessengerMessage(sender_psid, "माफ गर्नुहोला, अहिले म्यासेज प्रोसेस गर्न सकिन।");
                    }
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});


// फेसबुकमा म्यासेज पठाउने हेल्पर फंक्सन
async function sendMessengerMessage(sender_psid, response_text) {
    const request_body = {
        recipient: { id: sender_psid },
        message: { text: response_text }
    };

    try {
        await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body);
        console.log('Messenger message sent successfully!');
    } catch (error) {
        console.error('Unable to send messenger message:', error.response?.data || error.message);
    }
}


// Server Listen (एक ठाउँ मात्र सही तरिकाले राखिएको)
app.listen(PORT, "0.0.0.0", () => {
    console.log("================================");
    console.log("    NISCHAL AI SERVER (GEMINI)    ");
    console.log("================================");
    console.log(`Server is running on port ${PORT}`);
});
