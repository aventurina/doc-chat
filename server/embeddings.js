import { pipeline } from "@huggingface/transformers";

// Local, free embedding model (runs in-process, no API key or per-call cost).
// Loaded once and reused across requests.
let embedderPromise = null;

function getEmbedder() {
    if (!embedderPromise) {
        embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return embedderPromise;
}

export async function embedText(text) {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
}

export async function embedBatch(texts) {
    const embedder = await getEmbedder();
    const vectors = [];
    for (const text of texts) {
        const output = await embedder(text, { pooling: "mean", normalize: true });
        vectors.push(Array.from(output.data));
    }
    return vectors;
}
