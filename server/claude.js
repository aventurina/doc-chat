import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";
const MAX_OUTPUT_TOKENS = 500;
const MAX_CONTEXT_CHARS = 6000; // caps how much retrieved text gets sent per request

export function createClaudeClient({ apiKey = process.env.ANTHROPIC_API_KEY, client } = {}) {
    const anthropic = client || (apiKey ? new Anthropic({ apiKey }) : null);

    return {
        async answerFromContext(question, chunks) {
            if (!anthropic) {
                throw new Error("Server is missing ANTHROPIC_API_KEY.");
            }

            const context = chunks
                .map((c, i) => `[${i + 1}] ${c.text}`)
                .join("\n\n")
                .slice(0, MAX_CONTEXT_CHARS);

            const response = await anthropic.messages.create({
                model: MODEL,
                max_tokens: MAX_OUTPUT_TOKENS,
                system:
                    "Answer the user's question using only the numbered excerpts below. " +
                    "Cite sources inline like [1]. If the excerpts don't contain the answer, say so plainly.",
                messages: [
                    {
                        role: "user",
                        content: `Excerpts:\n\n${context}\n\nQuestion: ${question}`,
                    },
                ],
            });

            const text = response.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("");

            return { answer: text, usage: response.usage };
        },
    };
}
