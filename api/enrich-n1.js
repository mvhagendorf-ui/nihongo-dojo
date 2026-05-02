// One-shot enrichment endpoint for the N1 bulk import.
// Takes raw items { jp, reading, en } and returns enriched versions with
// conn / ex / exHeb / heb / kanjiStory.
// Called from scripts/enrich-n1.js — not used by the live app.

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };
const client = new Anthropic();

const SYSTEM = `You enrich Japanese vocabulary/grammar items for a JLPT N1 study app used by an Israeli learner (native Hebrew + English).

Each input item has: jp (kanji/kana form), reading (often romaji from source — convert to hiragana), en (English meaning).

For each item, return:
- jp: SAME as input. If grammar (e.g. "あえて", "ばこそ"), prefix with "～" if it attaches to a word. Keep nouns/verbs as-is.
- reading: hiragana only (convert romaji to hiragana — "akaji" → "あかじ", "an no jou" → "あんのじょう").
- en: SAME as input (clean it up if it's awkward, but preserve meaning, ≤ 80 chars).
- heb: short Hebrew translation of the meaning, ≤ 30 chars. Match register (casual/formal/literary).
- conn: connection/grammar rule — use the colored-pill notation:
   • Verbs: V辞書形, Vます形, Vて形, Vない形, Vた形, V普通形, V条件形
   • Nouns: N
   • Adjectives: い形, な形
   • Plain form: 普通形
   • Combinations like "N/Vた+の＋" or "V辞書形/Vない形＋"
   • For pure vocabulary nouns/verbs (not grammar): omit conn entirely.
- ex: ONE natural Japanese example sentence using the term. ≤ 30 chars. The example must clearly USE the term so a learner can see how it works in context.
- exHeb: clean Hebrew translation of the example, ≤ 50 chars.
- kanjiStory: ONLY if the term contains kanji — a memorable 1-sentence mnemonic that breaks down the kanji or explains etymology. Format like: "皮(skin) + 切(cut) = the first surgical cut → starting point". Keep it punchy (≤ 120 chars). Skip for pure-kana grammar like "ずとも", "がてら".
- oneLiner: skip unless the term has a particularly memorable nuance the learner would benefit from (e.g. proverb, idiom). Most items: omit.

Style: terse, learner-focused, no filler. Match the quality of these examples:

INPUT: { jp: "あえて", reading: "aete", en: "dare to" }
OUTPUT: { jp: "～あえて", reading: "あえて", en: "dare to / take the risk of", heb: "להעז ל", conn: "V辞書形＋", ex: "あえて反対意見を言う。", exHeb: "להעז להביע דעה מנוגדת." }

INPUT: { jp: "案の定", reading: "an no jou", en: "just as one thought" }
OUTPUT: { jp: "案の定", reading: "あんのじょう", en: "just as expected / sure enough", heb: "כצפוי", ex: "案の定、彼は遅刻した。", exHeb: "כצפוי, הוא איחר.", kanjiStory: "案(plan) + 定(decided) = the plan was decided/set → just as anticipated" }

INPUT: { jp: "赤字", reading: "akaji", en: "deficit" }
OUTPUT: { jp: "赤字", reading: "あかじ", en: "deficit / red ink (financial loss)", heb: "גרעון", ex: "今月も赤字だった。", exHeb: "גם החודש היה גרעון.", kanjiStory: "赤(red) + 字(letters) = red letters in a ledger → losses written in red ink" }

NEVER include the reading inside jp parentheses. NEVER include English in jp. ALWAYS Hebrew, never transliterate.`;

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
        required: ["jp", "reading", "en", "heb", "ex", "exHeb"],
        properties: {
          jp: { type: "string" },
          reading: { type: "string" },
          en: { type: "string" },
          heb: { type: "string" },
          conn: { type: "string" },
          ex: { type: "string" },
          exHeb: { type: "string" },
          kanjiStory: { type: "string" },
          oneLiner: { type: "string" },
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
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0 || items.length > 10) {
      return res.status(400).json({ error: "invalid_input", message: "Provide 1-10 items" });
    }

    const userText =
      `Enrich these ${items.length} JLPT N1 items. Return one entry per input, in the same order.\n\n` +
      items.map((it, i) => `${i + 1}. jp="${it.jp}" reading="${it.reading}" en="${it.en}"`).join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
    });

    const block = response.content.find(b => b.type === "text");
    if (!block) return res.status(502).json({ error: "no_output" });
    const parsed = JSON.parse(block.text);
    return res.status(200).json({ items: parsed.items || [], usage: response.usage });
  } catch (err) {
    console.error("enrich-n1 error:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "rate_limit", message: err.message });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: "api_error", message: err.message });
    }
    return res.status(500).json({ error: "internal", message: err.message || String(err) });
  }
}
