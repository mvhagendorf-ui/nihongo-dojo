// Reads scripts/n1-enriched.json and patches BOTH repos' src/data.js:
//   • adds N1_GRAMMAR_FULL + N1_VOCAB categories
//   • appends them to the right CATEGORY_GROUPS rows
//   • appends enriched items at the end of ALL_DATA
//
// Idempotent: if N1_GRAMMAR_FULL already exists in CATEGORIES, refuses to re-inject
// (so re-running won't duplicate). Pass FORCE=1 to bypass.
//
// PRIVATE (nihongo-dojo): items keep heb + exHeb fields.
// PUBLIC  (nihongo-dojo-public): heb + exHeb stripped, generic category labels.
//
// Run: node scripts/inject-n1.js

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENRICHED = "scripts/n1-enriched.json";
const PRIVATE_DATA = "src/data.js";
const PUBLIC_DATA  = "../nihongo-dojo-public/src/data.js";
const FORCE = !!process.env.FORCE;

if (!existsSync(ENRICHED)) {
  console.error(`ERROR: ${ENRICHED} not found — run enrich-n1.js first`);
  process.exit(1);
}
const enriched = JSON.parse(readFileSync(ENRICHED, "utf-8"));
console.log(`Loaded ${enriched.grammar.length} grammar + ${enriched.vocab.length} vocab from ${ENRICHED}`);

// Serialize one item to a single-line JS object literal.
// `keep`: which fields to include (the rest are stripped).
function itemToLiteral(item, cat, num, keep) {
  const ordered = ["jp", "reading", "en", "heb", "cat", "num", "conn", "ex", "exHeb", "n5syn", "kanjiStory", "oneLiner"];
  const parts = [];
  for (const k of ordered) {
    if (k === "cat") { parts.push(`cat: "${cat}"`); continue; }
    if (k === "num") { parts.push(`num: ${num}`); continue; }
    if (!keep.includes(k)) continue;
    const v = item[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}: ${JSON.stringify(v)}`);
  }
  return `  { ${parts.join(", ")} },`;
}

function buildItemsBlock(items, cat, kind, isPublic) {
  const keep = isPublic
    ? ["jp", "reading", "en", "conn", "ex", "n5syn", "kanjiStory", "oneLiner"]
    : ["jp", "reading", "en", "heb", "conn", "ex", "exHeb", "n5syn", "kanjiStory", "oneLiner"];
  const lines = items.map((it, i) => itemToLiteral(it, cat, i + 1, keep));
  return `\n  // ${kind}\n${lines.join("\n")}\n`;
}

// ─── patch one data.js file ───
function patchDataFile(path, isPublic) {
  if (!existsSync(path)) {
    console.log(`  ⚠ ${path} not found — skipping`);
    return;
  }
  let txt = readFileSync(path, "utf-8");

  if (txt.includes("N1_GRAMMAR_FULL:") && !FORCE) {
    console.log(`  ⏭ ${path} already injected — skipping (use FORCE=1 to bypass)`);
    return;
  }

  // ── 1. CATEGORIES ──
  const grammarLabel = isPublic ? "JLPT N1 完全 文法" : "N1 文法 完全";
  const vocabLabel   = isPublic ? "JLPT N1 語彙"      : "N1 語彙";
  const newCatLines =
    `  N1_GRAMMAR_FULL: "${grammarLabel}",\n` +
    `  N1_VOCAB: "${vocabLabel}",\n`;
  const before = `  CUSTOM: "Custom Quiz",`;
  if (!txt.includes(before)) throw new Error(`Could not find "${before}" anchor in ${path}`);
  txt = txt.replace(before, newCatLines + before);

  // ── 2. CATEGORY_GROUPS ──
  // Grammar group: append N1_GRAMMAR_FULL
  const grammarGroupRe = isPublic
    ? /(\{ label: "Grammar · 文法", cats: \[)([^\]]+)(\] \})/
    : /(\{ label: "文法 Grammar", cats: \[)([^\]]+)(\] \})/;
  if (!grammarGroupRe.test(txt)) throw new Error(`Could not find Grammar group in ${path}`);
  txt = txt.replace(grammarGroupRe, (_, a, mid, c) => `${a}${mid}, "N1_GRAMMAR_FULL"${c}`);

  // Vocab group: append N1_VOCAB
  const vocabGroupRe = isPublic
    ? /(\{ label: "Vocabulary · 語彙", cats: \[)([^\]]+)(\] \})/
    : /(\{ label: "語彙 Vocabulary", cats: \[)([^\]]+)(\] \})/;
  if (!vocabGroupRe.test(txt)) throw new Error(`Could not find Vocabulary group in ${path}`);
  txt = txt.replace(vocabGroupRe, (_, a, mid, c) => `${a}${mid}, "N1_VOCAB"${c}`);

  // ── 3. ALL_DATA append ──
  const grammarBlock = buildItemsBlock(enriched.grammar, "N1_GRAMMAR_FULL", "N1 GRAMMAR (FULL)", isPublic);
  const vocabBlock   = buildItemsBlock(enriched.vocab,   "N1_VOCAB",        "N1 VOCAB",          isPublic);
  // Find the last `];` of ALL_DATA
  // Strategy: ALL_DATA is the only top-level export ending in `];` after the items.
  // We find the last occurrence of `\n];` before EOF.
  const closeIdx = txt.lastIndexOf("\n];");
  if (closeIdx === -1) throw new Error(`Could not find ALL_DATA closing in ${path}`);
  txt = txt.slice(0, closeIdx) + grammarBlock + vocabBlock + txt.slice(closeIdx);

  writeFileSync(path, txt, "utf-8");
  console.log(`  ✓ ${path} patched (+${enriched.grammar.length} grammar, +${enriched.vocab.length} vocab)`);
}

console.log("\nPrivate repo:");
patchDataFile(PRIVATE_DATA, false);
console.log("\nPublic repo:");
patchDataFile(PUBLIC_DATA, true);

console.log("\nDone. Next steps:");
console.log("  • cd ../nihongo-dojo-public && npm run build  (sanity)");
console.log("  • git add -A && git commit -m '...' && git push  (in BOTH repos)");
console.log("  • Vercel auto-deploys both in ~60s");
