import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You build Japanese vocabulary quiz items from messy pasted text.

The user dumps a list of Japanese words / phrases / vocabulary they need to memorize — possibly with readings, English meanings, Hebrew, headings, bullet points, mixed languages, or just bare Japanese.

For EACH distinct Japanese term you find, output a structured item:
- jp: the term in its natural written form (with kanji where natural; e.g. "突然変異", "面接（めんせつ）", "謙譲語"). Preserve okurigana. Strip surrounding quotes/punctuation/list markers.
- reading: hiragana reading only (no katakana unless the term itself is katakana, e.g. "コンサル"). For pure-kana terms, repeat the term itself.
- en: short clear English meaning (≤ 80 chars). If the user gave one, use it; otherwise infer.
- ex: ONE natural Japanese example sentence using the term, ≤ 30 characters. Write a new one if none was provided.
- exHeb: clean Hebrew translation of the example sentence.

Skip headings, dates, formatting noise, separators, and English-only lines that aren't translations. Skip duplicates.
Keep items in the order they appear.
If the input has no recognizable Japanese terms, return { "items": [] }.`;

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
        required: ["jp", "reading", "en", "ex", "exHeb"],
        properties: {
          jp: { type: "string" },
          reading: { type: "string" },
          en: { type: "string" },
          ex: { type: "string" },
          exHeb: { type: "string" },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "missing_api_key", message: "ANTHROPIC_API_KEY not set in Vercel env vars" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const text = body?.text;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "invalid_input", message: "text is required" });
    }
    if (text.length > 12000) {
      return res.status(400).json({ error: "too_long", message: "Paste under 12000 chars" });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "no_output", message: "Model returned no text content" });
    }
    const parsed = JSON.parse(textBlock.text);
    return res.status(200).json({
      items: parsed.items || [],
      usage: response.usage,
    });
  } catch (err) {
    console.error("generate-quiz error:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "auth_error", message: "Invalid ANTHROPIC_API_KEY" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "rate_limit", message: "Rate limited — try again in a minute" });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: "api_error", message: err.message });
    }
    return res.status(500).json({ error: "internal", message: err.message || String(err) });
  }
}
