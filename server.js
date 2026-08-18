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
const genAI = new GoogleGenerativeAI(
process.env.GEMINI_API_KEY
);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(
bodyParser.json({
    limit: "1mb"
})
);

app.use(express.static(__dirname));

// ==========================================
// FACEBOOK SETTINGS
// ==========================================
const VERIFY_TOKEN = "nischal_bot_verify_token_2026";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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
Do NOT randomly add:
"मलाई निश्चल नेपालले coding गरेर बनाएको हो।"
Only say it when the user asks who created, made or coded you.

==================================================
ABOUT NISCHAL NEPAL
==================================================
If the user specifically asks:
"निश्चल नेपाल को हो?"
"Nishchal Nepal को हो?"
"Who is Nishchal Nepal?"
"निश्चलको बारेमा के थाहा छ?"
"Nishchal को बारेमा के थाहा छ?"
Use ONLY this information:
निश्चल नेपाल Nishchal AI लाई coding गरेर बनाउने व्यक्ति हुनुहुन्छ।
उहाँका बाबाको नाम गङ्गाप्रसाद नेपाल हो।
उहाँकी आमाको नाम कमला नेपाल हो।
उहाँकी दिदीको नाम सुस्मिता नेपाल हो।
उहाँकी अर्को दिदीको नाम अनशिका नेपाल हो।
उहाँका बाबा शिक्षक तथा प्रधानाध्यापक हुनुहुन्छ।

Do NOT invent any additional information about Nishchal Nepal or his family.

==================================================
ABOUT AISHAN KARKI
==================================================
IMPORTANT:
The correct spelling is:
Aishan Karki

If the user asks:
"Aishan Karki को हो?"
"आइसन कार्की को हो?"
"Aishan को बारेमा के थाहा छ?"
"आइसनको बारेमा के थाहा छ?"
"Who is Aishan Karki?"
Use ONLY this information:
Aishan Karki निश्चल नेपालको साथी हुनुहुन्छ।
उहाँ कक्षा १२ मा पढ्दै हुनुहुन्छ।
उहाँ १५ वर्षको हुनुहुन्छ।
उहाँको favorite game Free Fire हो।
उहाँ Free Fire मा एकदमै talented हुनुहुन्छ।
उहाँको favorite football player Cristiano Ronaldo हो।
उहाँको घर फलेलुङ–२, जोडपाटी हो।
उहाँ पढाइमा पनि एकदमै talented हुनुहुन्छ।

CRITICAL RULE:
Aishan Karki लाई TikTok celebrity नभन्नु।
Aishan Karki लाई TikTok content creator नभन्नु।
Aishan Karki TikTok मा famous छन् नभन्नु।
Aishan Karki को बारेमा माथि दिइएको जानकारी बाहेक अन्य personal information नबनाउनु।
यदि कुनै जानकारी दिइएको छैन भने:
"मसँग त्यसबारे जानकारी छैन।"
भन्नु।

==================================================
TECHNICAL ROLE
==================================================
Your main purpose is to answer technical questions.
You can help with:
Computer
Mobile
Networking
AI
Cyber Security
Programming
Software
Internet
Windows
Android
Website
Server
API
Troubleshooting
Technology

Give practical, clear and easy-to-understand answers.
When useful, give step-by-step instructions.

==================================================
FACT RULE
==================================================
Never invent personal information.
For Nishchal Nepal and Aishan Karki, use only the information explicitly provided above.
Do not use assumptions or make up facts.
If you don't know something, say:
"मसँग त्यसबारे जानकारी छैन।"
`;

// ==========================================
// GET GEMINI MODEL
// ==========================================
function getAIModel() {
return genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    systemInstruction: AI_INSTRUCTIONS
});
}

// ==========================================
// NORMALIZE TEXT
// ==========================================
function normalizeText(text) {
return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[?？!！.,।]/g, "");
}

// ==========================================
// FIXED INFORMATION
// ==========================================
function getFixedReply(userMessage) {
const text = normalizeText(userMessage);

const creatorKeywords = [
    "तिमीलाई कसले बनाएको",
    "तिमीलाई कसले बनायो",
    "तपाईंलाई कसले बनाएको",
    "तपाईंलाई कसले बनायो",
    "तपाईँलाई कसले बनाएको",
    "तपाईँलाई कसले बनायो",
    "who created you",
    "who made you",
    "who coded you",
    "who is your creator"
];

if (
    creatorKeywords.some((keyword) =>
        text.includes(keyword)
    )
) {
    return "मलाई निश्चल नेपालले coding गरेर बनाउनुभएको हो।";
}

const asksAboutAishan =
    (
        text.includes("aishan karki") ||
        text.includes("aishan") ||
        text.includes("आइसन कार्की") ||
        text.includes("आइसन")
    ) &&
    (
        text.includes("को हो") ||
        text.includes("को हुन") ||
        text.includes("को हुन्") ||
        text.includes("को होन") ||
        text.includes("बारेमा") ||
        text.includes("को बारे") ||
        text.includes("who") ||
        text.includes("about")
    );

if (asksAboutAishan) {
    return `Aishan Karki निश्चल नेपालको साथी हुनुहुन्छ।
उहाँ कक्षा १२ मा पढ्दै हुनुहुन्छ।
उहाँ १५ वर्षको हुनुहुन्छ।
उहाँको favorite game Free Fire हो र उहाँ Free Fire मा एकदमै talented हुनुहुन्छ।
उहाँको favorite football player Cristiano Ronaldo हो।
उहाँको घर फलेलुङ–२, जोडपाटी हो।
उहाँ पढाइमा पनि एकदमै talented हुनुहुन्छ।`;
}

const asksAboutNischal =
    (
        text.includes("nishchal nepal") ||
        text.includes("निश्चल नेपाल")
    ) &&
    (
        text.includes("को हो") ||
        text.includes("को हुन") ||
        text.includes("को हुन्") ||
        text.includes("बारेमा") ||
        text.includes("को बारे") ||
        text.includes("who") ||
        text.includes("about")
    );

if (asksAboutNischal) {
    return `निश्चल नेपाल Nishchal AI लाई coding गरेर बनाउने व्यक्ति हुनुहुन्छ।
उहाँका बाबाको नाम गङ्गाप्रसाद नेपाल हो।
उहाँकी आमाको नाम कमला नेपाल हो।
उहाँकी दिदीको नाम सुस्मिता नेपाल हो।
उहाँकी अर्को दिदीको नाम अनशिका नेपाल हो।
उहाँका बाबा शिक्षक तथा प्रधानाध्यापक हुनुहुन्छ।`;
}

return null;
}

// ==========================================
// GET AI RESPONSE
// ==========================================
async function getAIResponse(
userMessage,
history = []
) {
const fixedReply = getFixedReply(userMessage);

if (fixedReply) {
    return fixedReply;
}

const model = getAIModel();
const chat = model.startChat({
    history: history
});

const result = await chat.sendMessage(userMessage);
return result.response.text();
}

// ==========================================
// FRONTEND CHAT API
// ==========================================
app.post("/api/chat", async (req, res) => {
try {
    const userMessages = req.body.messages;

    if (!userMessages || !Array.isArray(userMessages)) {
        return res.status(400).json({
            error: "Invalid messages format."
        });
    }

    if (userMessages.length === 0) {
        return res.status(400).json({
            error: "No messages provided."
        });
    }

    const lastMessage = userMessages[userMessages.length - 1].content;

    const history = userMessages
        .slice(0, -1)
        .map((msg) => ({
            role:
                msg.role === "ai" ||
                msg.role === "model"
                    ? "model"
                    : "user",
            parts: [
                {
                    text: msg.content
                }
            ]
        }));

    const responseText = await getAIResponse(
        lastMessage,
        history
    );

    return res.json({
        answer: responseText
    });

} catch (error) {
    console.error(
        "Frontend Gemini Error:",
        error?.response?.data ||
        error?.message ||
        error
    );

    if (
        error?.status === 429 ||
        error?.message?.includes("429") ||
        error?.message?.toLowerCase()?.includes("quota")
    ) {
        return res.status(429).json({
            error: "अहिले Nishchal AI को free-tier limit पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।"
        });
    }

    return res.status(500).json({
        error: "Something went wrong."
    });
}
});

// ==========================================
// FACEBOOK WEBHOOK VERIFICATION
// ==========================================
app.get("/webhook", (req, res) => {
const mode = req.query["hub.mode"];
const token = req.query["hub.verify_token"];
const challenge = req.query["hub.challenge"];

if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
}
return res.sendStatus(400);
});

// ==========================================
// FACEBOOK MESSENGER WEBHOOK
// ==========================================
app.post("/webhook", async (req, res) => {
const body = req.body;

if (body.object !== "page") {
    return res.sendStatus(404);
}

try {
    for (const entry of body.entry || []) {
        for (const webhookEvent of entry.messaging || []) {
            const sender_psid = webhookEvent.sender?.id;

            if (!sender_psid) {
                continue;
            }

            if (
                !webhookEvent.message ||
                !webhookEvent.message.text
            ) {
                continue;
            }

            const userMessage = webhookEvent.message.text;
            console.log("Facebook User:", userMessage);

            try {
                const aiReply = await getAIResponse(userMessage);
                console.log("Nishchal AI:", aiReply);

                await sendMessengerMessage(
                    sender_psid,
                    aiReply
                );

            } catch (err) {
                console.error(
                    "Messenger AI Error:",
                    err?.response?.data ||
                    err?.message ||
                    err
                );

                if (
                    err?.status === 429 ||
                    err?.message?.includes("429") ||
                    err?.message?.toLowerCase()?.includes("quota")
                ) {
                    await sendMessengerMessage(
                        sender_psid,
                        "माफ गर्नुहोला 🙏 अहिले Nishchal AI को free-tier limit पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।"
                    );
                } else {
                    await sendMessengerMessage(
                        sender_psid,
                        "माफ गर्नुहोला 🙏 अहिले AI response दिन समस्या भयो। केही समयपछि फेरि प्रयास गर्नुहोस्।"
                    );
                }
            }
        }
    }

    return res.status(200).send("EVENT_RECEIVED");

} catch (error) {
    console.error(
        "Webhook Error:",
        error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(200).send("EVENT_RECEIVED");
}
});

// ==========================================
// SEND MESSAGE TO FACEBOOK
// ==========================================
async function sendMessengerMessage(
sender_psid,
response_text
) {
const request_body = {
    recipient: {
        id: sender_psid
    },
    message: {
        text: response_text
    }
};

try {
    await axios.post(
        `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        request_body
    );
    console.log("Messenger message sent successfully!");
} catch (error) {
    console.error(
        "Unable to send messenger message:",
        error?.response?.data ||
        error?.message ||
        error
    );
}
}

// ==========================================
// HOME / HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
res.send("Nishchal AI is running successfully! 🤖");
});

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, "0.0.0.0", () => {
console.log("================================");
console.log("        NISCHAL AI SERVER");
console.log("================================");
console.log(`Server is running on port ${PORT}`);
console.log("Facebook Webhook: /webhook");
});
