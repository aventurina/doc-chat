// Guards against a public demo silently running up a real API bill.
// This is a friendly, app-level limit — the real safety net is the hard
// spending cap you set on the Anthropic API key itself in their console,
// which holds even if this code has a bug.
export function createDailyLimiter(maxRequestsPerDay) {
    let day = currentDay();
    let count = 0;

    function currentDay() {
        return new Date().toISOString().slice(0, 10);
    }

    return {
        tryConsume() {
            const today = currentDay();
            if (today !== day) {
                day = today;
                count = 0;
            }

            if (count >= maxRequestsPerDay) {
                return { allowed: false, remaining: 0 };
            }

            count += 1;
            return { allowed: true, remaining: maxRequestsPerDay - count };
        },

        status() {
            const today = currentDay();
            const currentCount = today === day ? count : 0;
            return { used: currentCount, limit: maxRequestsPerDay, remaining: maxRequestsPerDay - currentCount };
        },
    };
}
