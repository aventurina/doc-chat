import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDailyLimiter } from "./rateLimit.js";

describe("createDailyLimiter", () => {
    test("allows requests up to the daily limit", () => {
        const limiter = createDailyLimiter(3);

        assert.equal(limiter.tryConsume().allowed, true);
        assert.equal(limiter.tryConsume().allowed, true);
        assert.equal(limiter.tryConsume().allowed, true);
        assert.equal(limiter.tryConsume().allowed, false);
    });

    test("reports remaining count accurately", () => {
        const limiter = createDailyLimiter(2);

        assert.equal(limiter.tryConsume().remaining, 1);
        assert.equal(limiter.tryConsume().remaining, 0);
    });

    test("status reflects usage without consuming", () => {
        const limiter = createDailyLimiter(5);
        limiter.tryConsume();
        limiter.tryConsume();

        const status = limiter.status();
        assert.deepEqual(status, { used: 2, limit: 5, remaining: 3 });
    });
});
