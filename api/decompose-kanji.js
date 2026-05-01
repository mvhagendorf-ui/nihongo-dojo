import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You decompose Japanese kanji into their visual components (radicals / sub-parts).

For each input kanji, output:
- kanji: the input character itself.
- radicals: an ordered list of the main visual sub-parts that make up this kanji. For each part: { char (the radical/component as a single Unicode character — use the actual radical character or kanji it appears as, e.g. 亻, 人, 木, 氵, 言), meaning (1-3 word English gloss), strokes (integer stroke count of THIS component) }.
  • Aim for 2-3 visually meaningful parts. Don't break down to single strokes.
  • Use the visually-occurring form (e.g. 休 → 亻 + 木, not 人 + 木; 海 → 氵 + 毎).
- mnemonic: ONE short sentence (≤ 80 chars) that ties the parts to the kanji's meaning, evocative and memorable.
  Example for 休: "person resting under a tree."
  Example for 信: "a person + words → trust."
  No filler like "this kanji means…" or "the components combine to…".

Skip: hiragana, katakana, punctuation, numbers — return only entries for actual kanji.

Single kanji like 一, 二, 人, 木, 大, 小 that are radicals themselves: return radicals: [] and a one-line mnemonic for the shape (e.g. for 人: "two legs walking — a person.").`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decompositions"],
  properties: {
    decompositions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kanji", "radicals", "mnemonic"],
        properties: {
          kanji: { type: "string" },
          mnemonic: { type: "string" },
          radicals: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["char", "meaning", "strokes"],
              properties: {
                char: { type: "string" },
                meaning: { type: "string" },
                strokes: { type: "integer" },
              },
            },
          },
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
    return res.status(500).json({ error: "missing_api_key" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const kanjis = Array.isArray(body?.kanjis) ? body.kanjis : [];
    const filtered = kanjis.filter(k => typeof k === "string" && /^[㐀-䶿一-龯豈-﫿]+$/.test(k));
    if (filtered.length === 0) {
      return res.status(400).json({ error: "invalid_input", message: "kanjis must be a non-empty array of kanji chars" });
    }
    if (filtered.length > 20) {
      return res.status(400).json({ error: "too_many", message: "Up to 20 kanji per request" });
    }

    const userMsg = `Decompose each of these kanji into their visual components:\n\n${filtered.join(" / ")}\n\nReturn one decomposition entry per input kanji, in the same order.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "no_output" });
    const parsed = JSON.parse(textBlock.text);
    return res.status(200).json({ decompositions: parsed.decompositions || [] });
  } catch (err) {
    console.error("decompose-kanji error:", err);
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: "api_error", message: err.message });
    }
    return res.status(500).json({ error: "internal", message: err.message || String(err) });
  }
}
