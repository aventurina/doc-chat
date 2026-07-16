import { test, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./index.js";

// Deterministic fake embeddings: same text always maps to the same vector,
// and the mock doesn't need the real (slow, model-downloading) embedder.
function fakeEmbed(text) {
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
    return [hash / 1000, 1 - hash / 1000, 0.5];
}

function testApp(overrides = {}) {
    return createApp({
        embedText: async (text) => fakeEmbed(text),
        embedBatch: async (texts) => texts.map(fakeEmbed),
        claudeClient: {
            answerFromContext: async (question, chunks) => ({
                answer: `Answer to "${question}" using ${chunks.length} excerpt(s).`,
                usage: { input_tokens: 10, output_tokens: 10 },
            }),
        },
        dailyRequestLimit: overrides.dailyRequestLimit ?? 50,
    });
}

describe("GET /api/health", () => {
    test("responds ok", async () => {
        const res = await request(testApp()).get("/api/health");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { status: "ok" });
    });
});

describe("POST /api/documents", () => {
    test("rejects a request with no file", async () => {
        const res = await request(testApp()).post("/api/documents");
        assert.equal(res.status, 400);
    });

    test("chunks and stores an uploaded text file", async () => {
        const res = await request(testApp())
            .post("/api/documents")
            .attach("file", Buffer.from("hello world, this is a test document."), {
                filename: "test.txt",
                contentType: "text/plain",
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.name, "test.txt");
        assert.ok(res.body.documentId);
        assert.equal(res.body.chunkCount, 1);
    });
});

describe("POST /api/chat", () => {
    test("requires documentId and question", async () => {
        const res = await request(testApp()).post("/api/chat").send({});
        assert.equal(res.status, 400);
    });

    test("404s for an unknown document", async () => {
        const res = await request(testApp())
            .post("/api/chat")
            .send({ documentId: "nope", question: "what is this?" });
        assert.equal(res.status, 404);
    });

    test("answers a question grounded in the uploaded document", async () => {
        const app = testApp();
        const uploadRes = await request(app)
            .post("/api/documents")
            .attach("file", Buffer.from("The sky is blue because of Rayleigh scattering."), {
                filename: "sky.txt",
                contentType: "text/plain",
            });

        const chatRes = await request(app)
            .post("/api/chat")
            .send({ documentId: uploadRes.body.documentId, question: "why is the sky blue?" });

        assert.equal(chatRes.status, 200);
        assert.match(chatRes.body.answer, /why is the sky blue/);
        assert.ok(chatRes.body.sources.length > 0);
    });

    test("returns 429 once the daily limit is hit", async () => {
        const app = testApp({ dailyRequestLimit: 1 });
        const uploadRes = await request(app)
            .post("/api/documents")
            .attach("file", Buffer.from("some content here"), {
                filename: "doc.txt",
                contentType: "text/plain",
            });

        const first = await request(app)
            .post("/api/chat")
            .send({ documentId: uploadRes.body.documentId, question: "q1" });
        const second = await request(app)
            .post("/api/chat")
            .send({ documentId: uploadRes.body.documentId, question: "q2" });

        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
    });
});

describe("GET /api/usage", () => {
    test("reports remaining request budget", async () => {
        const res = await request(testApp()).get("/api/usage");
        assert.equal(res.status, 200);
        assert.equal(res.body.limit, 50);
        assert.equal(res.body.used, 0);
    });
});
