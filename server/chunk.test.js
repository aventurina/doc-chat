import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "./chunk.js";

describe("chunkText", () => {
    test("returns no chunks for empty input", () => {
        assert.deepEqual(chunkText(""), []);
        assert.deepEqual(chunkText("   "), []);
    });

    test("returns a single chunk when text is shorter than chunk size", () => {
        const chunks = chunkText("one two three", 10, 2);
        assert.equal(chunks.length, 1);
        assert.equal(chunks[0], "one two three");
    });

    test("splits long text into overlapping chunks", () => {
        const words = Array.from({ length: 25 }, (_, i) => `word${i}`);
        const chunks = chunkText(words.join(" "), 10, 3);

        assert.ok(chunks.length > 1);
        // last word of one chunk should reappear near the start of the next (overlap)
        const firstChunkWords = chunks[0].split(" ");
        const secondChunkWords = chunks[1].split(" ");
        assert.ok(secondChunkWords.includes(firstChunkWords[firstChunkWords.length - 1]));
    });

    test("every word from the source text appears in the chunks", () => {
        const words = Array.from({ length: 37 }, (_, i) => `w${i}`);
        const chunks = chunkText(words.join(" "), 10, 2);
        const seen = new Set(chunks.join(" ").split(" "));
        for (const w of words) {
            assert.ok(seen.has(w), `expected ${w} to appear in some chunk`);
        }
    });
});
