import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You decompose Japanese kanji into their visual components (radicals / sub-parts). Accuracy is critical — these decompositions are shown to learners and a wrong radical teaches the wrong association.

For each input kanji, output:
- kanji: the input character itself.
- radicals: an ordered list of the main visual sub-parts. Each: { char (single Unicode character — use the actual radical/kanji as it appears: 亻, 忄, 氵, 木, 言, etc.), meaning (1-3 word English gloss), strokes (integer stroke count of THIS component) }.
  • Aim for 2-3 visually meaningful parts. Don't break down to single strokes.
  • Use the visually-occurring form: 休 → 亻 + 木; 海 → 氵 + 毎; 性 → 忄 + 生.
- mnemonic: ONE short sentence (≤ 80 chars) that ties the parts to the kanji's meaning. Concrete and evocative.

CRITICAL — frequently confused radicals. Trace the actual strokes before deciding:
  • 亻 person (in 休 信 体 何) — vertical line + slanted top stroke
  • 忄 heart (in 性 情 慣 怖) — short vertical with two short slashes; SEMANTICALLY about emotion/mind, not people. Default to 忄 over 亻 when meaning involves feelings/character.
  • 氵 water (3 dots, in 海 法 沿) vs 冫 ice (2 dots, in 冷 凍)
  • 礻 altar/spirit (in 神 社 礼) vs 衤 clothing (in 被 補 複) — clothing has an extra dot at top right
  • 月 moon/flesh (in 服 期 朝)
  • 扌 hand (in 持 押 投) vs 木 tree (in 林 村 校)
  • 阝 on the LEFT = mound (in 院 阪); on the RIGHT = village (in 部 都)
  • 艹 grass (in 花 草 茶 葉) — top of character
  • Always check semantics: if the kanji means "to feel", "personality", "fear" → 忄 not 亻; if it means "water-related" → 氵 not anything else.

Skip: hiragana, katakana, punctuation, numbers.

Single-radical kanji (一, 二, 人, 木, 大, 小, 山, 川, 月, 日, 火, 水, 車, etc.): return radicals: [] and a mnemonic describing the shape (e.g. 人: "two legs walking — a person.").`;

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
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
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
