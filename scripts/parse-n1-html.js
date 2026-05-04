// Parses japanesetest4you.com HTML downloads into raw N1 items.
// Output: scripts/n1-raw.json — { grammar: [...], vocab: [...] }
// Dedupes against existing N1_GRAMMAR entries in src/data.js.
//
// Run: node scripts/parse-n1-html.js

import { readFileSync, writeFileSync } from "node:fs";

const GRAMMAR_HTML = "C:/Users/mvhag/Downloads/JLPT N1 Grammar List – Japanesetest4you.com.html";
const VOCAB_HTML   = "C:/Users/mvhag/Downloads/JLPT N1 Vocabulary List – Japanesetest4you.com.html";
const DATA_PATH    = "src/data.js";
const OUTPUT       = "scripts/n1-raw.json";

// Decode HTML entities Wordpress emits (we mostly only need these few)
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#8230;/g, "…")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Each entry is on its own <p><a ...>JP (reading)</a>: english</p> line.
// Two slight format variants between grammar and vocab — both handled below.
function extractEntries(html) {
  const out = [];
  // Match: <p>...JP-with-paren-reading...</a>: english</p>   OR
  //        <p>...JP (reading): english...</a></p>            (vocab form)
  const re = /<p>\s*<a\s+[^>]*>([^<]+)<\/a>\s*:?\s*([^<]*)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inside = decode(m[1]).trim();   // e.g. "あえて (aete)"  OR  "赤字 (akaji): deficit"
    const after  = decode(m[2]).trim();   // e.g. "dare to"        OR  ""

    // Form A: jp+reading inside <a>, English after the </a>
    // Form B: jp+reading+english all inside <a> (vocab list uses this for some entries)
    let jp, reading, en;

    // Try B first — colon inside the <a> text
    const innerColon = inside.match(/^(.+?)\s*\(([^)]+)\):\s*(.+)$/);
    if (innerColon) {
      jp = innerColon[1].trim();
      reading = innerColon[2].trim();
      en = innerColon[3].trim();
    } else {
      // Form A
      const parenMatch = inside.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (!parenMatch) continue;        // skip non-conforming lines
      jp = parenMatch[1].trim();
      reading = parenMatch[2].trim();
      en = after;
    }

    // Filter out junk:
    if (!jp || !reading || !en) continue;
    if (jp.length > 60) continue;             // pagination / nav links
    // Reading should be hiragana/katakana; if it has spaces or latin chars it's romaji from the source.
    // We'll convert romaji→hiragana later in the enricher (Sonnet handles this trivially).

    out.push({ jp, reading, en });
  }
  return out;
}

// Strip a parenthetical reading if jp ended up like "案の定（あんのじょう）"
// (so dedup key is just the kanji form)
function dedupKey(jp) {
  return jp.replace(/[（(][^)）]*[)）]/g, "").replace(/^～/, "").trim();
}

// ─────────── parse ───────────
const grammarHtml = readFileSync(GRAMMAR_HTML, "utf-8");
const vocabHtml   = readFileSync(VOCAB_HTML, "utf-8");
const grammarRaw  = extractEntries(grammarHtml);
const vocabRaw    = extractEntries(vocabHtml);

// ─────────── dedupe against existing N1_GRAMMAR ───────────
const dataText = readFileSync(DATA_PATH, "utf-8");
const existingN1 = new Set();
const n1Re = /\{\s*jp:\s*"([^"]+)",[^}]*?cat:\s*"N1_GRAMMAR"/g;
let m;
while ((m = n1Re.exec(dataText)) !== null) existingN1.add(dedupKey(m[1]));

const grammar = grammarRaw.filter(it => !existingN1.has(dedupKey(it.jp)));
const vocab   = vocabRaw.filter(it => !existingN1.has(dedupKey(it.jp))); // (no N1_VOCAB exists yet)

console.log(`Grammar: parsed ${grammarRaw.length}, ${grammarRaw.length - grammar.length} dropped (overlap), ${grammar.length} new`);
console.log(`Vocab:   parsed ${vocabRaw.length}, ${vocabRaw.length - vocab.length} dropped (overlap), ${vocab.length} new`);
console.log(`Existing N1_GRAMMAR in data.js: ${existingN1.size}`);
console.log(`Total items to enrich: ${grammar.length + vocab.length}`);

// Show first/last 3 of each so we can eyeball quality
console.log("\nGrammar samples (first 3, last 3):");
[...grammar.slice(0, 3), ...grammar.slice(-3)].forEach(it => console.log(`  ${it.jp.padEnd(20)} (${it.reading.padEnd(18)}) → ${it.en}`));
console.log("\nVocab samples (first 3, last 3):");
[...vocab.slice(0, 3), ...vocab.slice(-3)].forEach(it => console.log(`  ${it.jp.padEnd(12)} (${it.reading.padEnd(14)}) → ${it.en}`));

writeFileSync(OUTPUT, JSON.stringify({ grammar, vocab }, null, 2), "utf-8");
console.log(`\n→ ${OUTPUT}`);
