const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

// Splits text into overlapping word-based chunks so a fact that falls near a
// chunk boundary is still likely to be fully contained in at least one chunk.
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const chunks = [];
    let start = 0;

    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        chunks.push(words.slice(start, end).join(" "));
        if (end === words.length) break;
        start = end - overlap;
    }

    return chunks;
}
