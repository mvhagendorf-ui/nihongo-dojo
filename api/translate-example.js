// Lightweight translation endpoint: takes batched { jp, ex, en } items,
// returns { jp, exEn } — natural English translation of the example sentence.
// Used by scripts/backfill-en-examples.js to add exEn to legacy N1 data.

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };
const client = new Anthropic();

const SYSTEM = `You translate Japanese example sentences from a JLPT study app into clear, natural English. The learner reads the JP sentence with the term highlighted; your job is to give them the meaning so they can understand the usage.

Each input has: jp (the term being studied), ex (one Japanese sentence using the term), en (the English meaning of the term — for context only).

Return: jp (echo) + exEn (clean natural English translation, ≤ 60 chars when reasonable).

Style: natural English, not literal word-for-word. Match register (formal/casual). If the JP sentence has furigana like 漢字(かんじ), ignore the readings — just translate the meaning.

Examples:
INPUT: { jp: "案の定", ex: "案の定、彼は遅刻した。", en: "just as expected" }
OUTPUT: { jp: "案の定", exEn: "Sure enough, he was late." }

INPUT: { jp: "～たて", ex: "このパン、できたてを買ってきたんだ。", en: "freshly done" }
OUTPUT: { jp: "～たて", exEn: "I bought this bread fresh out of the oven." }

INPUT: { jp: "弁明", ex: "彼は遅刻の弁明をした。", en: "explanation / excuse" }
OUTPUT: { jp: "弁明", exEn: "He gave an explanation for being late." }`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["jp", "exEn"],
        properties: {
          jp: { type: "string" },
          exEn: { type: "string" },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "missing_api_key" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: "invalid_input", message: "Provide 1-20 items" });
    }

    const userText =
      `Translate these ${items.length} Japanese example sentences. Return one entry per input, in the same order.\n\n` +
      items.map((it, i) => `${i + 1}. jp="${it.jp}" ex="${it.ex}" en="${it.en || ''}"`).join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const block = response.content.find(b => b.type === "text");
    if (!block) return res.status(502).json({ error: "no_output" });
    const parsed = JSON.parse(block.text);
    return res.status(200).json({ items: parsed.items || [], usage: response.usage });
  } catch (err) {
    console.error("translate-example error:", err);
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "rate_limit" });
    if (err instanceof Anthropic.APIError) return res.status(err.status || 500).json({ error: "api_error", message: err.message });
    return res.status(500).json({ error: "internal", message: err.message || String(err) });
  }
}
