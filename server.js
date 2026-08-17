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
// GEMINI
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ==========================================
// FACEBOOK
// ==========================================
const VERIFY_TOKEN = "nischal_bot_verify_token_2026";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ==========================================
// NISCHAL AI INSTRUCTIONS
// ==========================================
const AI_INSTRUCTIONS = `
You are Nischal AI, a helpful AI assistant created by Nischal Nepal.

LANGUAGE:
- Answer in Nepali when the user asks in Nepali.
- Answer in English when the user asks in English.
- If the user uses Nepali-English mix, reply naturally in Nepali-English mix.
- Keep answers clear, friendly and easy to understand.

==================================================
CREATOR OF NISCHAL AI
==================================================

If anyone asks:
- Who created you?
- Who made you?
- Who coded you?
- Who is your creator?
- तिमीलाई कसले बनाएको?
- तिमीलाई कसले बनायो?
- तपाईँलाई कसले बनाएको?
- तपाईंलाई कसले बनायो?

Always answer:

"मलाई निश्चल नेपालले coding गरेर बनाउनुभएको हो।"

Do not say that Google, Gemini, OpenAI, Meta, or anyone else created you.

==================================================
ABOUT NISCHAL NEPAL
==================================================

If anyone asks:
- Nishchal Nepal को हो?
- निश्चल नेपाल को हो?
- Who is Nishchal Nepal?
- Nishchal को बारेमा के थाहा छ?
- निश्चलको बारेमा के थाहा छ?
- Tell me about Nishchal Nepal.

Answer using this information:

"निश्चल नेपाल Nishchal AI लाई coding गरेर बनाउने व्यक्ति हुनुहुन्छ।
उहाँका बाबाको नाम गङ्गाप्रसाद नेपाल हो।
उहाँकी आमाको नाम कमला नेपाल हो।
उहाँकी दिदीको नाम सुस्मिता नेपाल हो।
उहाँकी अर्को दिदीको नाम अनशिका नेपाल हो।
उहाँका बाबा शिक्षक तथा प्रधानाध्यापक हुनुहुन्छ।"

Do not invent or guess any additional personal information about Nishchal Nepal or his family.

==================================================
ABOUT AISHAN KARKI
==================================================

Important: The correct spelling is "Aishan Karki".

If anyone asks:
- Aishan Karki को हो?
- आइसन कार्की को हो?
- Who is Aishan Karki?
- Aishan को बारेमा के थाहा छ?
- आइसनको बारेमा के थाहा छ?

Answer:

"Aishan Karki निश्चल नेपालको साथी हुनुहुन्छ।
उहाँ कक्षा १२ मा पढ्दै हुनुहुन्छ।
उहाँको favorite game Free Fire हो र उहाँ Free Fire मा एकदमै talented हुनुहुन्छ।
उहाँको favorite football player Cristiano Ronaldo हो।
उहाँ १५ वर्षको हुनुहुन्छ।
उहाँको घर फलेलुङ–२, जोडपाटी हो।
उहाँ पढाइमा पनि एकदमै talented हुनुहुन्छ।"

Do not invent or guess any additional personal information about Aishan Karki.

==================================================
TECHNICAL ROLE
==================================================

Your main purpose is to help users with technical topics such as:

- Computer
- Mobile
- Networking
- AI
- Cyber Security
- Programming
- Software
- Internet
- Troubleshooting
- Technology
- Windows
- Android
- Websites
- Servers
- APIs

Give practical and easy-to-understand answers.

If a technical question is unclear, ask the user for the missing information.

==================================================
IMPORTANT RULES
==================================================

1. Never invent personal information.
2. Never make up information about Nishchal Nepal or Aishan Karki.
3. When asked who created you, always say:
   "मलाई निश्चल नेपालले coding गरेर बनाउनुभएको हो।"
4. Follow the user's language.
5. Be friendly and helpful.
6. For technical questions, give step-by-step solutions when useful.
`;

// ==========================================
// GEMINI MODEL
// ==========================================
function getAIModel() {
    return genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: AI_INSTRUCTIONS
    });
}

// ==========================================
// GEMINI RESPONSE FUNCTION
// ==========================================
async function getAIResponse(userMessage, history = []) {
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

        const lastMessage =
            userMessages[userMessages.length - 1].content;

        const history = userMessages
            .slice(0, -1)
            .map((msg) => ({
                role:
                    msg.role === "ai" || msg.role === "model"
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

        res.json({
            answer: responseText
        });

    } catch (error) {
        console.error(
            "Frontend Gemini Error:",
            error?.response?.data || error?.message || error
        );

        // Gemini quota / rate limit
        if (
            error?.status === 429 ||
            error?.message?.includes("429") ||
            error?.message?.toLowerCase()?.includes("quota")
        ) {
            return res.status(429).json({
                error:
                    "अहिले AI को free-tier limit पुगेको छ। केही समयपछि फेरि प्रयास गर्नुहोस्।"
            });
        }

        res.status(500).json({
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
        if (
            mode === "subscribe" &&
            token === VERIFY_TOKEN
        ) {
            console.log("WEBHOOK_VERIFIED");

            return res
                .status(200)
                .send(challenge);
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

                // Sender
                const sender_psid =
                    webhookEvent.sender?.id;

                if (!sender_psid) {
                    continue;
                }

                // Ignore messages without text
                if (
                    !webhookEvent.message ||
                    !webhookEvent.message.text
                ) {
                    continue;
                }

                const userMessage =
                    webhookEvent.message.text;

                console.log(
                    "Facebook User:",
                    userMessage
                );

                try {
                    // Ask Nishchal AI
                    const aiReply = await getAIResponse(
                        userMessage
                    );

                    console.log(
                        "Nishchal AI:",
                        aiReply
                    );

                    // Send answer to Facebook
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

                    // Quota error
                    if (
                        err?.status === 429 ||
                        err?.message?.includes("429") ||
                        err?.message
                            ?.toLowerCase()
                            ?.includes("quota")
                    ) {

                        await sendMessengerMessage(
                            sender_psid,
                            "माफ गर्नुहोला 🙏 अहिले Nishchal AI को free-tier limit पुगेको छ। केही समयपछि फेरि message गर्नुहोस्।"
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

        // Facebook expects this quickly
        return res
            .status(200)
            .send("EVENT_RECEIVED");

    } catch (error) {

        console.error(
            "Webhook Error:",
            error?.response?.data ||
            error?.message ||
            error
        );

        // Still return 200 so Facebook doesn't repeatedly resend
        return res
            .status(200)
            .send("EVENT_RECEIVED");
    }
});

// ==========================================
// SEND MESSAGE TO FACEBOOK MESSENGER
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

        console.log(
            "Messenger message sent successfully!"
        );

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
// HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
    res.send("Nishchal AI is running successfully! 🤖");
});

// ==========================================
// SERVER
// ==========================================
app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "     NISCHAL AI SERVER"
        );

        console.log(
            "================================"
        );

        console.log(
            `Server is running on port ${PORT}`
        );

        console.log(
            "Facebook Messenger Webhook: /webhook"
        );
    }
);
