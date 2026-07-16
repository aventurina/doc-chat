import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createVectorStore } from "./store.js";

describe("createVectorStore", () => {
    test("search returns [] for an unknown document", () => {
        const store = createVectorStore();
        assert.deepEqual(store.search("missing", [1, 0, 0]), []);
    });

    test("ranks chunks by cosine similarity to the query", () => {
        const store = createVectorStore();
        store.addDocument("doc1", "test.txt", [
            { text: "about cats", embedding: [1, 0, 0] },
            { text: "about dogs", embedding: [0, 1, 0] },
            { text: "unrelated", embedding: [0, 0, 1] },
        ]);

        const results = store.search("doc1", [1, 0, 0], 2);

        assert.equal(results.length, 2);
        assert.equal(results[0].text, "about cats");
        assert.ok(results[0].score > results[1].score);
    });

    test("hasDocument and listDocuments reflect stored documents", () => {
        const store = createVectorStore();
        assert.equal(store.hasDocument("doc1"), false);

        store.addDocument("doc1", "notes.txt", [{ text: "a", embedding: [1, 0] }]);

        assert.equal(store.hasDocument("doc1"), true);
        assert.deepEqual(store.listDocuments(), [{ id: "doc1", name: "notes.txt", chunkCount: 1 }]);
    });
});
