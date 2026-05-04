// One-shot test endpoint: generates a clean black-silhouette SVG for a kanji's meaning.
// Used by scripts/test-silhouettes.js to evaluate whether AI-drawn silhouettes
// are good enough to ship as visual aids next to the existing Components tile.

import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };
const client = new Anthropic();

const SYSTEM_SILHOUETTE = `You generate single-color silhouette SVG illustrations for Japanese kanji learning aids.

Each input has: kanji (the character) + meaning (its English meaning) + optional concept (a more concrete visual hint).

Output a clean SVG silhouette that visually depicts the kanji's meaning — same style as the umbrella / horse / turtle silhouettes in classic kanji-origin diagrams.

Strict requirements:
- viewBox="0 0 200 200"
- Solid black fill ("#1a1a1a"), no outlines, no shading, no gradients
- Recognizable from a distance — silhouette must clearly read as the concept
- Simple shape, like an icon — no fine detail
- No text, no decoration, no kanji glyphs in the SVG
- Centered with ~10-20px margin
- Use <path> with d= attribute for organic shapes; <rect>, <circle>, <polygon> are fine for geometric concepts
- If the concept is abstract or hard to draw simply, return { "svg": null, "reason": "..." } instead of inventing nonsense

Output JSON: { "svg": "<svg ...>...</svg>", "reason": "" }
or
{ "svg": null, "reason": "abstract concept; no clean visual" }

Examples of GOOD silhouettes:
- 馬 (horse) → side profile of rearing horse with mane
- 亀 (turtle) → top-down turtle with shell pattern outline simplified to a circle, head + 4 legs + tail poking out
- 傘 (umbrella) → classic umbrella shape: dome + handle
- 木 (tree) → trunk + canopy
- 鳥 (bird) → side-profile flying bird
- 雨 (rain) → cloud with falling drops
- 山 (mountain) → 2-3 peak triangles
- 火 (fire) → flame shape
- 月 (moon) → crescent

Examples to REFUSE:
- 進 (advance/progress) → too abstract
- 必 (must/certainly) → too abstract
- 経 (sutra/passage) → too abstract`;

const SYSTEM_SCENE = `You generate illustrated MNEMONIC SCENE SVGs for Japanese kanji — like the famous JLPT Kanji Mnemonics images that show, for example, "a hand grabbing an ear" for 取 (to take).

Each input has: kanji (the character) + meaning (its English meaning) + optional concept (a hint).
You'll be told the radicals making up the kanji.

Goal: draw a SHORT VISUAL STORY combining the radicals into a scene that explains why the kanji means what it means.

Examples of the bar to hit:
- 取 (take) = 耳 (ear) + 又 (hand) → a hand reaching out and grabbing an ear
- 休 (rest) = 亻 (person) + 木 (tree) → a person leaning/resting against a tree
- 鳴 (sing/cry) = 口 (mouth) + 鳥 (bird) → a bird with a mouth open singing
- 林 (woods) = 木 + 木 → two trees side by side
- 明 (bright) = 日 (sun) + 月 (moon) → sun next to moon
- 信 (faith/trust) = 亻 (person) + 言 (words) → a person with speech bubble showing words

Strict requirements:
- viewBox="0 0 240 200" (wider than tall for scenes)
- Mostly solid black ("#1a1a1a"); white ("#ffffff") permitted for inner detail
- Multi-element scene — show INTERACTION between the radicals, not just objects placed next to each other
- Recognizable: a learner should immediately think "ah, ear + hand = grabbing → take"
- No text, no decoration, no kanji or hiragana glyphs in the SVG
- Use multiple <path>/<circle>/<ellipse>/<polygon> elements as needed
- Refuse if the kanji isn't a phonosemantic compound with concrete radicals: return { "svg": null, "reason": "..." }

Output JSON: { "svg": "<svg ...>...</svg>", "reason": "one-line description of what the scene shows" }
or
{ "svg": null, "reason": "no concrete radical-based scene possible" }`;

const SYSTEMS = { silhouette: SYSTEM_SILHOUETTE, scene: SYSTEM_SCENE };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["svg"],
  properties: {
    svg: { type: ["string", "null"] },
    reason: { type: "string" },
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
    const { kanji, meaning, concept, style = "silhouette", radicals } = body || {};
    if (!kanji || !meaning) {
      return res.status(400).json({ error: "invalid_input", message: "Provide { kanji, meaning, concept?, style?, radicals? }" });
    }
    const system = SYSTEMS[style];
    if (!system) {
      return res.status(400).json({ error: "invalid_style", message: "style must be 'silhouette' or 'scene'" });
    }

    const radicalsLine = (style === "scene" && Array.isArray(radicals) && radicals.length > 0)
      ? `\nradicals: ${radicals.map(r => `${r.char} (${r.meaning})`).join(" + ")}`
      : "";
    const userText =
      `kanji: ${kanji}\nmeaning: ${meaning}${concept ? `\nconcept hint: ${concept}` : ""}${radicalsLine}\n\n` +
      (style === "scene"
        ? "Draw a mnemonic scene combining the radicals. Refuse if no concrete scene is possible."
        : "Draw a clean black silhouette that depicts this concept. If too abstract, return svg: null with a reason.");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const block = response.content.find(b => b.type === "text");
    if (!block) return res.status(502).json({ error: "no_output" });
    const parsed = JSON.parse(block.text);
    return res.status(200).json({ ...parsed, usage: response.usage });
  } catch (err) {
    console.error("generate-silhouette error:", err);
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: "api_error", message: err.message });
    }
    return res.status(500).json({ error: "internal", message: err.message || String(err) });
  }
}
