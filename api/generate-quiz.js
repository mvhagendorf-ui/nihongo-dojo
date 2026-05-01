import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You build Japanese vocabulary quiz items from user input. Input can be:
1. Pasted text (a messy list of words, sentences, mixed languages)
2. An image of a Japanese textbook / newspaper / book page
3. A PDF
4. Any combination

For each distinct, learnable Japanese term you find — focus on substantive vocabulary: nouns, verbs, adjectives, set phrases, idioms, grammar points. Skip particles, super-common function words (です, ます, の, は, etc.), pure proper names, and obvious cognates unless they're the point of the lesson.

For each item output:
- jp: the term in its natural written form (with kanji where natural; e.g. "突然変異", "謙譲語"). Preserve okurigana. Strip surrounding quotes/punctuation/list markers.
- reading: hiragana reading only (no katakana unless the term itself is katakana, e.g. "コンサル"). For pure-kana terms, repeat the term itself.
- en: short clear English meaning (≤ 80 chars). If the user provided one, prefer it; otherwise infer.
- ex: ONE Japanese example sentence using the term, ≤ 35 characters.
  • If the term came from an image/PDF/passage and a real sentence containing it is visible in the source — use that exact sentence (or shorten it to its core clause if too long).
  • Otherwise write a natural example.
- exHeb: clean Hebrew translation of the example sentence.

Skip duplicates. Keep items in the order they appear. Cap output at ~40 items even if the source has more — pick the most learning-worthy.
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
    const text = (body?.text || "").trim();
    // Accept `images: [...]` (preferred) or legacy single `image` for back-compat
    const images = Array.isArray(body?.images) ? body.images : (body?.image ? [body.image] : []);

    if (!text && images.length === 0) {
      return res.status(400).json({ error: "invalid_input", message: "Provide text, files, or both" });
    }
    if (text.length > 12000) {
      return res.status(400).json({ error: "too_long", message: "Paste under 12000 chars" });
    }
    if (images.length > 4) {
      return res.status(400).json({ error: "too_many_files", message: "Up to 4 files at a time" });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
    let totalBytes = 0;
    for (const im of images) {
      if (!im || !allowed.includes(im.mediaType) || typeof im.data !== "string") {
        return res.status(400).json({ error: "invalid_image", message: "Files must be PNG/JPEG/WebP/GIF or PDF" });
      }
      totalBytes += im.data.length;
    }
    if (totalBytes > 4_000_000) {
      return res.status(400).json({ error: "image_too_large", message: "Combined file size too large — remove a file or use smaller ones" });
    }

    const userContent = [];
    for (const im of images) {
      if (im.mediaType === "application/pdf") {
        userContent.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: im.data },
        });
      } else {
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: im.mediaType, data: im.data },
        });
      }
    }
    if (text) {
      userContent.push({ type: "text", text });
    } else if (images.length > 0) {
      const hint = images.length > 1
        ? "Extract Japanese vocabulary from these sources. Treat them as a single connected source (e.g. consecutive pages)."
        : "Extract Japanese vocabulary from this source.";
      userContent.push({ type: "text", text: hint });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
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
