// Reads scripts/jlpt-enriched.json and patches PUBLIC repo's src/data.js:
//   • Adds N5_GRAMMAR, N5_VOCAB, N4_GRAMMAR, N4_VOCAB, N3_GRAMMAR, N3_VOCAB,
//     N2_GRAMMAR_FULL, N2_VOCAB categories
//   • Restructures CATEGORY_GROUPS into level-first organization (N5→N1)
//   • Appends enriched items at the end of ALL_DATA
//
// Public-only (Ron asked). Idempotent: refuses to re-inject if N5_GRAMMAR
// already exists. Pass FORCE=1 to bypass.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENRICHED = "scripts/jlpt-enriched.json";
const PUBLIC_DATA = "../nihongo-dojo-public/src/data.js";
const FORCE = !!process.env.FORCE;

if (!existsSync(ENRICHED)) {
  console.error(`ERROR: ${ENRICHED} not found`);
  process.exit(1);
}
const enriched = JSON.parse(readFileSync(ENRICHED, "utf-8"));

const COUNTS = {};
let totalNew = 0;
for (const lvl of ["N5", "N4", "N3", "N2"]) {
  COUNTS[lvl] = { g: enriched[lvl]?.grammar?.length || 0, v: enriched[lvl]?.vocab?.length || 0 };
  totalNew += COUNTS[lvl].g + COUNTS[lvl].v;
}
console.log("Loaded enriched data:");
for (const lvl of ["N5", "N4", "N3", "N2"]) console.log(`  ${lvl}: ${COUNTS[lvl].g} grammar + ${COUNTS[lvl].v} vocab`);
console.log(`  Total: ${totalNew} new items\n`);

// ── per-item literal serialization (public — no heb fields) ──
function itemToLiteral(item, cat, num) {
  const ordered = ["jp", "reading", "en", "cat", "num", "conn", "ex", "exEn", "kanjiStory", "oneLiner"];
  const parts = [];
  for (const k of ordered) {
    if (k === "cat") { parts.push(`cat: "${cat}"`); continue; }
    if (k === "num") { parts.push(`num: ${num}`); continue; }
    const v = item[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}: ${JSON.stringify(v)}`);
  }
  return `  { ${parts.join(", ")} },`;
}

function buildBlock(items, cat, label) {
  const lines = items.map((it, i) => itemToLiteral(it, cat, i + 1));
  return `\n  // ${label}\n${lines.join("\n")}\n`;
}

if (!existsSync(PUBLIC_DATA)) {
  console.error(`ERROR: ${PUBLIC_DATA} not found`);
  process.exit(1);
}
let txt = readFileSync(PUBLIC_DATA, "utf-8");

if (txt.includes("N5_GRAMMAR:") && !FORCE) {
  console.log(`⏭ ${PUBLIC_DATA} already injected — skipping (use FORCE=1 to bypass)`);
  process.exit(0);
}

// ── 1. CATEGORIES insertion ──
const newCatLines =
  `  N5_GRAMMAR: "JLPT N5 文法",\n` +
  `  N5_VOCAB: "JLPT N5 語彙",\n` +
  `  N4_GRAMMAR: "JLPT N4 文法",\n` +
  `  N4_VOCAB: "JLPT N4 語彙",\n` +
  `  N3_GRAMMAR: "JLPT N3 文法",\n` +
  `  N3_VOCAB: "JLPT N3 語彙",\n` +
  `  N2_GRAMMAR_FULL: "JLPT N2 完全 文法",\n` +
  `  N2_VOCAB: "JLPT N2 語彙",\n`;
const beforeAnchor = `  CUSTOM: "Custom Quiz",`;
if (!txt.includes(beforeAnchor)) throw new Error(`Could not find CATEGORIES anchor`);
txt = txt.replace(beforeAnchor, newCatLines + beforeAnchor);

// ── 2. CATEGORY_GROUPS restructure (level-first) ──
const newGroups = `export const CATEGORY_GROUPS = [
  { label: "N5 初級", cats: ["N5_GRAMMAR", "N5_VOCAB"] },
  { label: "N4 初級II", cats: ["N4_GRAMMAR", "N4_VOCAB"] },
  { label: "N3 中級", cats: ["N3_GRAMMAR", "N3_VOCAB"] },
  { label: "N2 上級", cats: ["N2_GRAMMAR", "N2_GRAMMAR_FULL", "N2_VOCAB", "N2_VERBS", "BUSINESS_VOCAB"] },
  { label: "N1 上級II", cats: ["N1_GRAMMAR", "N1_GRAMMAR_FULL", "N1_VOCAB"] },
  { label: "Conversation · 会話", cats: ["ELITE_ADVERBS", "CONNECTORS"] },
];`;
const groupsRe = /export const CATEGORY_GROUPS = \[[\s\S]*?\];/;
if (!groupsRe.test(txt)) throw new Error(`Could not find CATEGORY_GROUPS`);
txt = txt.replace(groupsRe, newGroups);

// ── 3. ALL_DATA append ──
const blocks = [
  buildBlock(enriched.N5?.grammar || [], "N5_GRAMMAR", "N5 GRAMMAR"),
  buildBlock(enriched.N5?.vocab   || [], "N5_VOCAB",   "N5 VOCAB"),
  buildBlock(enriched.N4?.grammar || [], "N4_GRAMMAR", "N4 GRAMMAR"),
  buildBlock(enriched.N4?.vocab   || [], "N4_VOCAB",   "N4 VOCAB"),
  buildBlock(enriched.N3?.grammar || [], "N3_GRAMMAR", "N3 GRAMMAR"),
  buildBlock(enriched.N3?.vocab   || [], "N3_VOCAB",   "N3 VOCAB"),
  buildBlock(enriched.N2?.grammar || [], "N2_GRAMMAR_FULL", "N2 GRAMMAR (FULL)"),
  buildBlock(enriched.N2?.vocab   || [], "N2_VOCAB",        "N2 VOCAB"),
];
const closeIdx = txt.lastIndexOf("\n];");
if (closeIdx === -1) throw new Error(`Could not find ALL_DATA closing`);
txt = txt.slice(0, closeIdx) + blocks.join("") + txt.slice(closeIdx);

writeFileSync(PUBLIC_DATA, txt, "utf-8");
console.log(`✓ ${PUBLIC_DATA} patched`);
console.log(`  +8 categories (N5/N4/N3 grammar+vocab, N2_GRAMMAR_FULL, N2_VOCAB)`);
console.log(`  CATEGORY_GROUPS restructured (level-first: N5→N1)`);
console.log(`  +${totalNew} items appended to ALL_DATA`);
console.log("");
console.log("Next:");
console.log("  cd ../nihongo-dojo-public && npm run build  (sanity)");
console.log("  cd ../nihongo-dojo-public && git add -A && git commit -m '...' && git push");
