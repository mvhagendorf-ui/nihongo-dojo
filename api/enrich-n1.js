// Enrichment endpoint used by scripts/enrich-n1.js (N1 bulk import)
// and scripts/enrich-jlpt.js (N2-N5 bulk import).
//
// Two modes via `mode` field:
//   "n1"   — Israeli-learner full output (heb + exHeb included). DEFAULT.
//   "jlpt" — public-app output, NO Hebrew. Also supports romaji-only input
//            (jp missing) where the model reconstructs the JP form.

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };
const client = new Anthropic();

const SYSTEM_N1 = `You enrich Japanese vocabulary/grammar items for a JLPT N1 study app used by an Israeli learner (native Hebrew + English).

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
- ex: ONE natural Japanese example sentence using the term. ≤ 30 chars.
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

const SYSTEM_JLPT = `You enrich Japanese vocabulary/grammar items for a public JLPT study app (no Hebrew). Output is shown to learners — examples MUST be translatable in their head, etymology MUST be vivid enough to draw a mental picture.

Each input has: jp (CANONICAL Japanese form, may be missing for PDF-extracted grammar entries), reading (hiragana or romaji from source), en (English meaning), level (N5/N4/N3/N2). Optionally exRomaji + exEn (extracted example sentence — use as a hint to write the JP example).

For each item, return:
- jp: the canonical Japanese form. RULES:
   • If input has jp, USE IT (just normalize: prefix grammar with "～" if it attaches to a word, keep nouns/verbs as-is).
   • If jp is MISSING (PDF source), RECONSTRUCT from reading + en + level context:
       — Grammar particles/conjunctions are usually PURE HIRAGANA. "dake" → "～だけ", "made" → "～まで", "kara" → "～から", "node" → "～ので".
       — Some N4/N3 grammar uses kanji. "de aru" → "である", "ni totte" → "～にとって" (kana).
       — Vocab items use standard kanji forms. "taberu" → "食べる", "kaisha" → "会社".
       — Cross-check: your jp must naturally READ as the given romaji.
- reading: hiragana only (convert any romaji).
- en: clean English meaning ≤ 80 chars.
- conn: grammar connection rule — colored-pill notation: V辞書形, Vます形, Vて形, Vない形, Vた形, N, い形, な形, 普通形, combinations like "N/Vた+の＋". For pure vocab nouns/verbs: OMIT conn entirely.
- ex: ONE natural Japanese example sentence using the term, ≤ 35 chars. If input had exRomaji, base your example on it (convert romaji to JP).
- exEn: REQUIRED — clear, simple English translation of the example sentence (≤ 60 chars). Don't be too literal; phrase it naturally. This is shown to non-Japanese readers so they understand the example.
- kanjiStory: REQUIRED for EVERY item. Vivid 1-sentence mnemonic, ≤ 120 chars, beginner-friendly ("etymology for dummies"):
   • Items WITH kanji → break down each kanji as a literal picture/meaning, then show how they combine. Format: "X(picture/meaning) + Y(picture/meaning) = visual story → final meaning". Examples:
       - 赤字: "赤(red) + 字(letters/characters) = red letters in a ledger → financial loss"
       - 弁明: "弁(speak/argue) + 明(clarify) = speak to make clear → explanation/excuse"
       - 取: "耳(ear) + 又(hand) = a hand grabbing an ear (battlefield trophy) → to take"
   • Pure-kana items (e.g. ～だけ, ～から, がてら) → explain the GRAMMATICAL ORIGIN or a memorable hook. Examples:
       - "～だけ": "From classical 'tadake' (just only) → narrows down to one thing → 'only X'"
       - "～から": "Originally meant 'from' (point of departure) → reason 'from which something follows'"
       - "がてら": "Old form of 'while doing' (途中で) → doing one thing on the way to another"
   • Even simple items (e.g. もう, よく) — give a one-line hook that helps it stick.
- oneLiner: skip unless the term has notably memorable nuance (proverb, idiom). Most items: omit.
- level: ECHO BACK the input level field as-is.

Style: terse, learner-focused, vivid imagery.

EXAMPLES:

INPUT (HTML): { jp: "暴れる", reading: "abareru", en: "to act violently; to rage; to struggle", level: "N2" }
OUTPUT: { jp: "暴れる", reading: "あばれる", en: "to act violently / rage / struggle", level: "N2", ex: "酔っ払いが店で暴れた。", exEn: "The drunk guy went on a rampage in the shop.", kanjiStory: "暴(violent/storm) + れる(do/become) = becoming a storm → going wild" }

INPUT (PDF, no jp): { reading: "dake", en: "only, just", level: "N5" }
OUTPUT: { jp: "～だけ", reading: "だけ", en: "only / just", level: "N5", conn: "N/V普通形＋", ex: "水だけください。", exEn: "Just water, please.", kanjiStory: "From classical 'tadake' meaning 'just only' → narrows down to a single thing" }

INPUT (PDF with example): { reading: "ato de", en: "after, later", level: "N4", exRomaji: "shukudai o shita ato de tabemasu", exEn: "I'll eat after I do my homework." }
OUTPUT: { jp: "～あとで", reading: "あとで", en: "after / later", level: "N4", conn: "Vた形/N＋の＋", ex: "宿題をしたあとで食べます。", exEn: "I'll eat after doing my homework.", kanjiStory: "後(behind/after) + で(at/in) = at the point behind/after something happens" }

INPUT (vocab kanji): { reading: "taberu", en: "to eat", level: "N5" }
OUTPUT: { jp: "食べる", reading: "たべる", en: "to eat", level: "N5", ex: "朝ごはんを食べる。", exEn: "I eat breakfast.", kanjiStory: "食(food/meal — picture of food in a vessel) → the action of eating food" }

NEVER include the reading inside jp parentheses. NEVER include English in jp. NO Hebrew in this mode. EVERY item MUST have exEn + kanjiStory.`;

const SCHEMA_N1 = {
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

const SCHEMA_JLPT = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["jp", "reading", "en", "ex", "exEn", "kanjiStory", "level"],
        properties: {
          jp: { type: "string" },
          reading: { type: "string" },
          en: { type: "string" },
          level: { type: "string", enum: ["N5", "N4", "N3", "N2"] },
          conn: { type: "string" },
          ex: { type: "string" },
          exEn: { type: "string" },
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
    const mode = body?.mode === "jlpt" ? "jlpt" : "n1";
    if (items.length === 0 || items.length > 10) {
      return res.status(400).json({ error: "invalid_input", message: "Provide 1-10 items" });
    }

    const userText =
      `Enrich these ${items.length} items. Return one entry per input, in the same order.\n\n` +
      items.map((it, i) => {
        const fields = [];
        if (it.jp) fields.push(`jp="${it.jp}"`);
        fields.push(`reading="${it.reading}"`);
        fields.push(`en="${it.en}"`);
        if (it.level) fields.push(`level="${it.level}"`);
        if (it.exRomaji) fields.push(`exRomaji="${it.exRomaji}"`);
        if (it.exEn) fields.push(`exEn="${it.exEn}"`);
        return `${i + 1}. ${fields.join(" ")}`;
      }).join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: [{ type: "text", text: mode === "jlpt" ? SYSTEM_JLPT : SYSTEM_N1, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
      output_config: {
        format: { type: "json_schema", schema: mode === "jlpt" ? SCHEMA_JLPT : SCHEMA_N1 },
      },
    });

    const block = response.content.find(b => b.type === "text");
    if (!block) return res.status(502).json({ error: "no_output" });
    const parsed = JSON.parse(block.text);
    return res.status(200).json({ items: parsed.items || [], mode, usage: response.usage });
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
