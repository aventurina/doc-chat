function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// A minimal in-memory vector store. Documents live only for the lifetime of
// the server process — no SQLite, no external vector DB. Simple by design:
// a demo/portfolio RAG app doesn't need documents to survive a restart, and
// keeping state in memory sidesteps persistence issues on ephemeral hosting.
export function createVectorStore() {
    const documents = new Map(); // documentId -> { name, chunks: [{ text, embedding }] }

    return {
        addDocument(documentId, name, chunks) {
            documents.set(documentId, { name, chunks });
        },

        hasDocument(documentId) {
            return documents.has(documentId);
        },

        listDocuments() {
            return [...documents.entries()].map(([id, doc]) => ({
                id,
                name: doc.name,
                chunkCount: doc.chunks.length,
            }));
        },

        search(documentId, queryEmbedding, topK = 4) {
            const doc = documents.get(documentId);
            if (!doc) return [];

            return doc.chunks
                .map((chunk) => ({
                    text: chunk.text,
                    score: cosineSimilarity(chunk.embedding, queryEmbedding),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
        },
    };
}
