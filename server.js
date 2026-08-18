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
// INITIALIZE GEMINI (Gemini 1.5 Flash - Best for Multimodal/Audio/Vision)
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(bodyParser.json({ limit: "15mb" })); // अडियो र इमेज फाइलको लागि बढाएको
app.use(express.static(__dirname));

const VERIFY_TOKEN = "nischal_bot_verify_token_2026";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ==========================================
// CHAT SESSIONS STORAGE (For Messenger Memory)
// ==========================================
const messengerSessions = new Map();

// ==========================================
// NISCHAL AI SYSTEM INSTRUCTIONS
// ==========================================
const AI_INSTRUCTIONS = `
You are Nischal AI, a helpful technical AI assistant.

LANGUAGE RULE:
If the user speaks Nepali, answer in Nepali.
If the user speaks English, answer in English.
If the user uses Nepali-English mix, answer naturally in Nepali-English mix.
Keep answers friendly, clear and easy to understand.

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
"मलाई निश्चल नेपालले coding गरेर बनाउनुभएको हो।"

IMPORTANT:
Do NOT mention Nischal Nepal as your creator in normal answers.
Only say it when the user asks who created, made or coded you.

==================================================
ABOUT NISCHAL NEPAL
==================================================
If the user specifically asks about Nishchal Nepal, use ONLY this information:
निश्चल नेपाल Nishchal AI लाई coding गरेर बनाउने व्यक्ति हुनुहुन्छ।
उहाँका बाबाको नाम गङ्गाप्रसाद नेपाल हो।
उहाँकी आमाको नाम कमला नेपाल हो।
उहाँकी दिदीको नाम सुस्मिता नेपाल हो।
उहाँकी अर्को दिदीको नाम अनशिका नेपाल हो।
उहाँका बाबा शिक्षक तथा प्रधानाध्यापक हुनुहुन्छ।

==================================================
ABOUT AISHAN KARKI
==================================================
If the user asks about Aishan Karki, use ONLY this information:
Aishan Karki निश्चल नेपालको साथी हुनुहुन्छ।
उहाँ कक्षा १२ मा पढ्दै हुनुहुन्छ।
उहाँ १५ वर्षको हुनुहुन्छ।
उहाँको favorite game Free Fire हो।
उहाँ Free Fire मा एकदमै talented हुनुहुन्छ।
उहाँको favorite football player Cristiano Ronaldo हो।
उहाँको घर फलेलुङ–२, जोडपाटी हो।
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

// लाइभ मौसम जानकारी
async function getLiveWeather(city) {
    try {
        const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=3`, { timeout: 5000 });
        return response.status === 200 ? `हालको मौसम (${city}): ${response.data.trim()}` : null;
    } catch (e) { return null; }
}

// फ्री वेब सर्च (DuckDuckGo API)
async function searchWeb(query) {
    try {
        const response = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, { timeout: 5000 });
        if (response.data && response.data.AbstractText) {
            return response.data.AbstractText;
        } else if (response.data && response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
            return response.data.RelatedTopics[0].Text || null;
        }
    } catch (e) {
        console.error("Web Search Error:", e.message);
    }
    return null;
}

// URL बाट अडियो वा इमेज फाइल डाउनलोड गरेर जेमिनीमा पठाउन मिल्ने buffer ढाँचामा बदल्ने
async function urlToGenerativePart(url, mimeType) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return {
        inlineData: {
            data: Buffer.from(response.data).toString("base64"),
            mimeType
        },
    };
}

// ==========================================
// MESSENGER WEBHOOK (Full Logic: Memory + Vision + Weather + Voice + Search)
// ==========================================
app.post("/webhook", async (req, res) => {
    const body = req.body;
    if (body.object !== "page") return res.sendStatus(404);

    for (const entry of body.entry || []) {
        for (const webhookEvent of entry.messaging || []) {
            const sender_psid = webhookEvent.sender.id;
            
            try {
                // १. अट्याचमेन्ट ह्यान्डलिङ (फोटो वा भ्वाइस मेसेज)
                if (webhookEvent.message?.attachments) {
                    const attachment = webhookEvent.message.attachments[0];
                    const mediaUrl = attachment.payload.url;
                    
                    if (attachment.type === "image") {
                        // फोटो प्रशोधन गर्ने
                        const imagePart = await urlToGenerativePart(mediaUrl, "image/jpeg");
                        const model = getAIModel();
                        const result = await model.generateContent([imagePart, "यो फोटोमा के छ वा यसले के देखाउँछ? प्रष्टसँग उत्तर दिनुहोस्।"]);
                        await sendMessengerMessage(sender_psid, result.response.text());
                    } 
                    else if (attachment.type === "audio") {
                        // भ्वाइस मेसेज (अडियो) प्रशोधन गर्ने
                        const audioPart = await urlToGenerativePart(mediaUrl, "audio/mp4");
                        const model = getAIModel();
                        const result = await model.generateContent([audioPart, "यो भ्वाइस मेसेजमा के भनिएको छ? त्यसको उत्तर दिनुहोस्।"]);
                        await sendMessengerMessage(sender_psid, result.response.text());
                    }
                } 
                // २. टेक्स्ट मेसेज ह्यान्डलिङ
                else if (webhookEvent.message?.text) {
                    const userMessage = webhookEvent.message.text;
                    const lowerMsg = userMessage.toLowerCase();
                    
                    // मौसम चेक गर्ने
                    if (lowerMsg.includes("मौसम") || lowerMsg.includes("weather")) {
                        let city = "Kathmandu";
                        if (lowerMsg.includes("इलाम")) city = "Ilam";
                        else if (lowerMsg.includes("पोखरा")) city = "Pokhara";
                        else if (lowerMsg.includes("विराटनगर")) city = "Biratnagar";
                        
                        const weather = await getLiveWeather(city);
                        await sendMessengerMessage(sender_psid, weather || "अहिले मौसम जानकारी उपलब्ध छैन।");
                    } 
                    // वेब सर्च चेक गर्ने
                    else if (lowerMsg.includes("search") || lowerMsg.includes("खोज") || lowerMsg.includes("news")) {
                        const searchResult = await searchWeb(userMessage);
                        if (searchResult) {
                            await sendMessengerMessage(sender_psid, `इन्टरनेटबाट प्राप्त जानकारी:\n\n${searchResult}`);
                        } else {
                            if (!messengerSessions.has(sender_psid)) {
                                messengerSessions.set(sender_psid, getAIModel().startChat({ history: [] }));
                            }
                            const chat = messengerSessions.get(sender_psid);
                            const result = await chat.sendMessage(userMessage);
                            await sendMessengerMessage(sender_psid, result.response.text());
                        }
                    }
                    // साधारण च्याट (मेमरी सहित)
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
                await sendMessengerMessage(sender_psid, "माफ गर्नुहोला 🙏 यो मेसेज प्रोसेस गर्नमा केही समस्या आयो। फेरि प्रयास गर्नुहोस्।");
            }
        }
    }
    res.status(200).send("EVENT_RECEIVED");
});

async function sendMessengerMessage(sender_psid, response_text) {
    try {
        await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            recipient: { id: sender_psid },
            message: { text: response_text }
        });
    } catch (error) { console.error("Error sending message:", error?.response?.data || error.message); }
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nischal AI Server (with Full Memory, Vision, Weather, Search & Voice) is running on port ${PORT}`);
});
