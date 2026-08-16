import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// AI instructions
const AI_INSTRUCTIONS = `
You are Nishchal AI, a helpful AI assistant.
Answer the user's question directly and naturally.
`;

// Chat API Route
app.post("/api/chat", async (req, res) => {
    try {
        const userMessages = req.body.messages;
        const lastMessage = userMessages[userMessages.length - 1].content;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.5-flash-lite",
            systemInstruction: AI_INSTRUCTIONS
        });
        
        const history = userMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
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

app.listen(PORT, () => {
    console.log("================================");
    console.log("   NISCHAL AI SERVER (GEMINI)   ");
    console.log("================================");
    console.log(`Website: http://localhost:${PORT}`);
});
