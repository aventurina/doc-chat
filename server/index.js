import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { chunkText } from "./chunk.js";
import { createVectorStore } from "./store.js";
import { createDailyLimiter } from "./rateLimit.js";
import { createClaudeClient } from "./claude.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_CHUNKS_PER_DOCUMENT = 200; // caps embedding work per upload
const DEFAULT_DAILY_REQUEST_LIMIT = 50;

async function extractText(file) {
    if (file.mimetype === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(file.buffer);
        return data.text;
    }
    return file.buffer.toString("utf-8");
}

export function createApp({
    embedText,
    embedBatch,
    claudeClient = createClaudeClient(),
    dailyRequestLimit = DEFAULT_DAILY_REQUEST_LIMIT,
} = {}) {
    if (!embedText || !embedBatch) {
        throw new Error("createApp requires embedText and embedBatch implementations.");
    }

    const app = express();
    app.use(cors());
    app.use(express.json());

    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });
    const store = createVectorStore();
    const limiter = createDailyLimiter(dailyRequestLimit);

    app.post("/api/documents", upload.single("file"), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        try {
            const text = await extractText(req.file);
            const chunks = chunkText(text).slice(0, MAX_CHUNKS_PER_DOCUMENT);

            if (chunks.length === 0) {
                return res.status(400).json({ error: "Couldn't extract any text from that file." });
            }

            const embeddings = await embedBatch(chunks);
            const documentId = crypto.randomUUID();

            store.addDocument(
                documentId,
                req.file.originalname,
                chunks.map((text, i) => ({ text, embedding: embeddings[i] }))
            );

            res.json({ documentId, name: req.file.originalname, chunkCount: chunks.length });
        } catch (error) {
            res.status(500).json({ error: `Failed to process document: ${error.message}` });
        }
    });

    app.post("/api/chat", async (req, res) => {
        const { documentId, question } = req.body || {};

        if (!documentId || !question) {
            return res.status(400).json({ error: "documentId and question are required." });
        }

        if (!store.hasDocument(documentId)) {
            return res.status(404).json({ error: "Unknown documentId. Upload a document first." });
        }

        const { allowed, remaining } = limiter.tryConsume();
        if (!allowed) {
            return res.status(429).json({ error: "Demo request limit reached for today. Please try again tomorrow." });
        }

        try {
            const queryEmbedding = await embedText(question);
            const topChunks = store.search(documentId, queryEmbedding);

            if (topChunks.length === 0) {
                return res.json({ answer: "I couldn't find anything relevant in the document.", sources: [], remaining });
            }

            const { answer } = await claudeClient.answerFromContext(question, topChunks);
            res.json({ answer, sources: topChunks.map((c) => c.text), remaining });
        } catch (error) {
            res.status(502).json({ error: `Failed to generate an answer: ${error.message}` });
        }
    });

    app.get("/api/usage", (req, res) => {
        res.json(limiter.status());
    });

    app.get("/api/health", (req, res) => res.json({ status: "ok" }));

    const distPath = path.join(__dirname, "..", "dist");
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
    const { embedText, embedBatch } = await import("./embeddings.js");
    const dailyRequestLimit = process.env.DAILY_REQUEST_LIMIT
        ? Number(process.env.DAILY_REQUEST_LIMIT)
        : DEFAULT_DAILY_REQUEST_LIMIT;
    const app = createApp({ embedText, embedBatch, dailyRequestLimit });
    const PORT = process.env.PORT || 4003;
    app.listen(PORT, () => {
        console.log(`doc-chat server running on http://localhost:${PORT}`);
    });
}
