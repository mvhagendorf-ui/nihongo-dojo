import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };
const client = new Anthropic();

// ─────────── ITEMS MODE (default — no instructions provided) ───────────
const ITEMS_SYSTEM = `You build Japanese vocabulary quiz items from user input. The user is studying Japanese (their native languages are English and Hebrew). Input can be:

1. VOCABULARY LIST — a messy list of words / sentences / translations. EXTRACT each distinct Japanese term that's already in the list.
2. IMAGE / PDF — a textbook page, newspaper, or scanned material. EXTRACT every learnable Japanese term you can read from the source.
3. TOPIC / REQUEST — the user describes what they want a quiz about, e.g. "vocab for a McDonald's job interview", "20 N1 kanji", "verbs for cooking", "polite phrases for a hotel check-in", "JLPT N2 grammar", "phrases a dentist would use". In this case, GENERATE 18-25 relevant, useful Japanese vocabulary items appropriate to the request. Pick concrete, high-value terms a learner would actually want to know for that situation. Match difficulty to any level mentioned (N5/N4/N3/N2/N1).
4. Any combination of the above.

How to decide the mode:
- Mostly Japanese characters or a recognizable word list → mode 1.
- Description/instruction in English, Hebrew, or other non-extraction language → mode 3.
- Mixed → extract what's there, supplement only if asked.

For each distinct, learnable Japanese term — focus on substantive vocabulary: nouns, verbs, adjectives, set phrases, idioms, grammar points. Skip particles, super-common function words (です, ます, の, は, etc.), pure proper names, and obvious cognates unless they're the point of the lesson.

For each item output:
- jp: the term in its natural written form (with kanji where natural; e.g. "突然変異", "謙譲語", "お越しになる"). Preserve okurigana. Strip surrounding quotes/punctuation/list markers. NEVER include the reading in parentheses inside this field — the reading goes in the "reading" field only. ✗ "お越しになる（おこしになる）" ✓ "お越しになる".
- reading: hiragana reading only (no katakana unless the term itself is katakana, e.g. "コンサル"). For pure-kana terms, repeat the term itself.
- en: short clear English meaning (≤ 80 chars). If the user provided one, prefer it; otherwise infer.
- ex: ONE Japanese example sentence using the term, ≤ 35 characters.
  • If the term came from an image/PDF/passage and a real sentence containing it is visible in the source — use that exact sentence (or shorten it to its core clause if too long).
  • Otherwise write a natural example.
- exHeb: clean Hebrew translation of the example sentence.

Skip duplicates. Keep items in the order they appear. Cap output at ~40 items even if the source has more — pick the most learning-worthy.
If the input has no recognizable Japanese terms, return { "items": [] }.`;

const ITEMS_SCHEMA = {
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

// ─────────── QUESTIONS MODE (when instructions provided) ───────────
const QUESTIONS_SYSTEM = `You design multiple-choice Japanese quiz questions for an N1 learner (native English + Hebrew). The user provides source material (vocabulary list, image/PDF, or topic) AND instructions describing what kind of quiz they want.

Generate 18-25 multiple-choice questions that PRECISELY match the user's instructions. Each question stands on its own.

Every question is one of these TYPES — pick whichever best serves the instructions, and mix freely if the instructions allow:

1. "meaning" — show JP term as prompt → 4 English meanings, pick correct.
   prompt: "案の定"  choices: ["just as expected", "by chance", "barely", "in vain"]  correctIdx: 0

2. "fillBlank" — JP sentence with ＿＿＿ → 4 JP word/phrase choices.
   prompt: "彼は＿＿＿遅刻した。"  choices: ["案の定", "案外", "案じる", "意外と"]  correctIdx: 0

3. "reading" — show kanji/word → 4 hiragana readings.
   prompt: "案の定"  choices: ["あんのじょう", "あんていじょう", "あんのてい", "あんじょう"]  correctIdx: 0

4. "particle" — JP sentence with one particle blank → 4 particles.
   prompt: "学校＿行く。"  choices: ["へ", "を", "で", "が"]  correctIdx: 0

5. "conjugation" — "Form X of Y?" → 4 conjugated forms.
   prompt: "「食べる」の使役形は？"  choices: ["食べさせる", "食べられる", "食べたい", "食べよう"]  correctIdx: 0

6. "register" — "Polite/humble/respectful form of X?" → 4 keigo variants.
   prompt: "「言う」の謙譲語は？"  choices: ["申し上げる", "おっしゃる", "申される", "述べる"]  correctIdx: 0

7. "synonym" — "Closest in meaning to X?" → 4 JP candidates.
   prompt: "案の定 に最も近い意味は？"  choices: ["やはり", "意外と", "偶然", "辛うじて"]  correctIdx: 0

8. "general" — any other style the instructions imply (true/false-style, register matching, kanji decomposition, etc.). Use this sparingly when none of the above fit.
   prompt: "...the question..."  choices: [...]  correctIdx: ...

For each question, output:
- type: one of the strings above.
- prompt: the question text shown to the learner. Include any context (sentence, kanji, instruction) needed to answer.
- promptKind: "kanji" if prompt is a single word/kanji to display large, "sentence" if it's a Japanese sentence (use this for fillBlank too), "instruction" if it's an English/Japanese instruction like "What's the past tense of X?" Default to "instruction" if unsure.
- choices: EXACTLY 4 strings. All distinct. Distractors must be PLAUSIBLE — same category, similar form, easy to confuse for a real learner. Never random unrelated junk.
- correctIdx: 0-3.
- explanation: ONE short sentence (≤ 120 chars) explaining why the correct answer is correct, shown after the user picks. Optional but strongly preferred.
- source: { jp, reading?, en, heb? } — the underlying term being tested. jp is the canonical written form; reading is hiragana if jp has kanji; en is English meaning; heb is Hebrew (≤ 30 chars).

Match instructions PRECISELY:
- "fill in the blank only" → every question type:"fillBlank"
- "drill keigo" → mix "register" + "meaning" focused on keigo verbs
- "test reading recognition" → every question type:"reading"
- "kanji + meaning mix" → 50/50 "reading" and "meaning"
- "general N1 grammar quiz" → mix "meaning" + "fillBlank" + occasional "synonym"
- Specific topic ("McDonald's interview") → generate appropriate items first, then build questions around them per any style direction

If no items can be derived from input, return { "questions": [] }.`;

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "prompt", "choices", "correctIdx", "source"],
        properties: {
          type: {
            type: "string",
            enum: ["meaning", "fillBlank", "reading", "particle", "conjugation", "register", "synonym", "general"],
          },
          prompt: { type: "string" },
          promptKind: { type: "string", enum: ["kanji", "sentence", "instruction"] },
          choices: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
          },
          correctIdx: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          source: {
            type: "object",
            additionalProperties: false,
            required: ["jp", "en"],
            properties: {
              jp: { type: "string" },
              reading: { type: "string" },
              en: { type: "string" },
              heb: { type: "string" },
            },
          },
        },
      },
    },
  },
};

// ─────────── handler ───────────
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
    const instructions = (body?.instructions || "").trim();
    const images = Array.isArray(body?.images) ? body.images : (body?.image ? [body.image] : []);

    if (!text && images.length === 0) {
      return res.status(400).json({ error: "invalid_input", message: "Provide text, files, or both" });
    }
    if (text.length > 12000) {
      return res.status(400).json({ error: "too_long", message: "Paste under 12000 chars" });
    }
    if (instructions.length > 1000) {
      return res.status(400).json({ error: "instructions_too_long", message: "Quiz style under 1000 chars" });
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

    const useQuestions = instructions.length > 0;

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
        ? "Source material — treat as a single connected source (e.g. consecutive pages)."
        : "Source material.";
      userContent.push({ type: "text", text: hint });
    }
    if (useQuestions) {
      userContent.push({
        type: "text",
        text: `\n--- QUIZ STYLE INSTRUCTIONS ---\n${instructions}\n\nDesign questions that follow these instructions exactly.`,
      });
    }

    const model = useQuestions ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const response = await client.messages.create({
      model,
      max_tokens: useQuestions ? 8000 : 16000,
      system: useQuestions ? QUESTIONS_SYSTEM : ITEMS_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: {
        format: { type: "json_schema", schema: useQuestions ? QUESTIONS_SCHEMA : ITEMS_SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "no_output", message: "Model returned no text content" });
    }
    const parsed = JSON.parse(textBlock.text);
    return res.status(200).json({
      items: parsed.items || undefined,
      questions: parsed.questions || undefined,
      mode: useQuestions ? "questions" : "items",
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
