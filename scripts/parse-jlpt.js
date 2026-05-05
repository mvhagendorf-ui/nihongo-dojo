// Parses JLPT N2-N5 source files (HTML + PDF) into raw items.
// Output: scripts/jlpt-raw.json — { N5: {grammar, vocab}, N4: {...}, N3: {...}, N2: {...} }
// Dedupes against existing data.js entries (N1_GRAMMAR, N1_GRAMMAR_FULL, N1_VOCAB, N2_GRAMMAR).
//
// Run: node scripts/parse-jlpt.js
// Prereq: pdftotext on PATH (mingw64 or poppler).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DOWNLOADS = "C:/Users/mvhag/Downloads";
const FILES = {
  N5: { vocabHtml: `${DOWNLOADS}/JLPT N5 Vocabulary List – Japanesetest4you.com.html`, grammarPdf: `${DOWNLOADS}/jlpt-n5-grammar-list.pdf` },
  N4: { vocabHtml: `${DOWNLOADS}/JLPT N4 Vocabulary List – Japanesetest4you.com.html`, grammarPdf: `${DOWNLOADS}/jlpt-n4-grammar-list.pdf` },
  N3: { vocabHtml: `${DOWNLOADS}/JLPT N3 Vocabulary List – Japanesetest4you.com.html`, grammarPdf: `${DOWNLOADS}/jlpt-n3-grammar-list.pdf` },
  N2: { vocabHtml: `${DOWNLOADS}/JLPT N2 Vocabulary List – Japanesetest4you.com.html`, grammarHtml: `${DOWNLOADS}/JLPT N2 Grammar List – Japanesetest4you.com.html` },
};
const DATA_PATH = "../nihongo-dojo-public/src/data.js";  // dedup against PUBLIC repo (only target)
const OUTPUT = "scripts/jlpt-raw.json";

// ── HTML decoder for WordPress entities ──
function decode(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#8230;/g, "…")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8203;/g, "")  // zero-width space (common in N5 vocab)
    .replace(/​/g, "")        // bare zero-width space
    .trim();
}

// ── A. HTML grammar/vocab with <a href> wrapper (N2 grammar, N5/N4/N3 vocab) ──
function extractHtmlLinked(html) {
  const out = [];
  const re = /<p>\s*<a\s+[^>]*>([^<]+)<\/a>\s*:?\s*([^<]*)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inside = decode(m[1]);
    const after  = decode(m[2]);
    let jp, reading, en;
    // Form B: jp+reading+english all inside <a>: "赤字 (akaji): deficit"
    const innerColon = inside.match(/^(.+?)\s*\(([^)]+)\):\s*(.+)$/);
    if (innerColon) {
      jp = innerColon[1].trim();
      reading = innerColon[2].trim();
      en = innerColon[3].trim();
    } else {
      // Form A: "あえて (aete)" inside <a>, English after
      const parenMatch = inside.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (!parenMatch) continue;
      jp = parenMatch[1].trim();
      reading = parenMatch[2].trim();
      en = after;
    }
    if (!jp || !reading || !en) continue;
    if (jp.length > 60) continue;
    out.push({ jp, reading, en });
  }
  return out;
}

// ── B. HTML plain-paragraph vocab (N2 vocab format) ──
//   "暴れる (abareru): to act violently; to rage; ..."
function extractHtmlPlain(html) {
  const out = [];
  const re = /<p>([一-龯ぁ-んァ-ンー][^<()]*?)\s*\(([a-zA-Z\s]+)\)\s*:\s*([^<]+)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const jp = decode(m[1]);
    const reading = decode(m[2]);
    const en = decode(m[3]).replace(/​/g, "").trim();
    if (!jp || !reading || !en) continue;
    if (jp.length > 60) continue;
    out.push({ jp, reading, en });
  }
  return out;
}

// ── C. PDF grammar (JP chars don't extract — only romaji + English available) ──
//   Format: " (dake): only, just" or "(dake) - 1: in, at, on" (numbered variants)
//   Followed by an English example + a romaji example on the next lines.
function extractPdfGrammar(pdfPath) {
  const tmp = join(tmpdir(), `pdf-${Date.now()}.txt`);
  execSync(`pdftotext "${pdfPath}" "${tmp}"`);
  const txt = readFileSync(tmp, "utf-8");
  const lines = txt.split(/\r?\n/);

  const out = [];
  // Identify entry-header lines: lines containing "(romaji): meaning" with no other content
  // Also handle "(romaji) - N: meaning" variants
  const headerRe = /^\s*\(?\s*([a-z][a-z \/]*?)\)?\s*(?:-\s*\d+\s*)?:\s*(.+?)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(headerRe);
    if (!m) continue;

    const romaji = m[1].trim();
    const en = m[2].trim();

    // Skip false positives: too short, contains uppercase JLPT, etc.
    if (!romaji || romaji.length < 2) continue;
    if (en.length < 2 || en.length > 200) continue;
    if (/JLPT|GRAMMAR|LIST|TEST|LEVEL/i.test(en)) continue;
    if (/^[A-Z]/.test(romaji)) continue;  // sentence starts, not entries

    // Look ahead for English example + romaji example (within next 6 lines)
    let exEn = null, exRomaji = null;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const L = lines[j].trim();
      if (!L) continue;
      // Romaji example: lowercase letters, possibly ending with period
      if (!exRomaji && /^[a-z][a-z\s,.'!?]+[a-z.!?]$/i.test(L) && L.length > 8 && /[a-z]/.test(L)) {
        // Distinguish English from romaji: romaji has no common English words
        const hasEnglish = /\b(the|of|and|to|in|is|was|are|with|that|this|for|on|at|by|from|or|an?|be|have|do)\b/i.test(L);
        if (hasEnglish) { if (!exEn) exEn = L; }
        else { exRomaji = L; }
      }
      if (exEn && exRomaji) break;
      // Stop if we hit another entry header
      if (j > i + 1 && headerRe.test(lines[j])) break;
    }

    out.push({
      reading: romaji,    // hiragana/romaji form (will be hiragana'd by enricher)
      en,                 // meaning
      ...(exRomaji ? { exRomaji } : {}),
      ...(exEn ? { exEn } : {}),
      _pdf: true,         // flag so enricher reconstructs jp from romaji
    });
  }
  return out;
}

// ── dedup key (matches enrich-n1.js) ──
function dedupKey(jp) {
  return (jp || "").replace(/～/g, "").replace(/[（(][^)）]*[)）]/g, "").trim();
}

// ── load existing data.js entries to avoid duplicates ──
function loadExistingKeys() {
  const txt = readFileSync(DATA_PATH, "utf-8");
  const keys = { grammar: new Set(), vocab: new Set() };
  // Match items with cat: "N1_GRAMMAR", "N1_GRAMMAR_FULL", "N1_VOCAB", "N2_GRAMMAR"
  const re = /\{\s*jp:\s*"([^"]+)",[^}]*?cat:\s*"(N1_GRAMMAR|N1_GRAMMAR_FULL|N1_VOCAB|N2_GRAMMAR|N2_VERBS|BUSINESS_VOCAB|ELITE_ADVERBS|CONNECTORS)"/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const k = dedupKey(m[1]);
    if (m[2].includes("VOCAB") || m[2] === "N2_VERBS" || m[2] === "BUSINESS_VOCAB" || m[2] === "ELITE_ADVERBS") {
      keys.vocab.add(k);
    } else {
      keys.grammar.add(k);
    }
  }
  return keys;
}

// ── main ──
console.log(`Reading data from ${DATA_PATH} for dedup...`);
const existing = loadExistingKeys();
console.log(`  existing: ${existing.grammar.size} grammar, ${existing.vocab.size} vocab\n`);

const result = {};
let totalIn = 0, totalOut = 0;

for (const [level, files] of Object.entries(FILES)) {
  console.log(`─── ${level} ───`);
  let grammarRaw = [], vocabRaw = [];

  // Grammar
  if (files.grammarHtml) {
    const html = readFileSync(files.grammarHtml, "utf-8");
    grammarRaw = extractHtmlLinked(html);
    console.log(`  grammar (HTML linked): ${grammarRaw.length}`);
  } else if (files.grammarPdf) {
    grammarRaw = extractPdfGrammar(files.grammarPdf);
    console.log(`  grammar (PDF): ${grammarRaw.length}`);
  }

  // Vocab
  if (files.vocabHtml) {
    const html = readFileSync(files.vocabHtml, "utf-8");
    let v = extractHtmlLinked(html);
    if (v.length === 0) v = extractHtmlPlain(html);  // N2 vocab fallback
    vocabRaw = v;
    console.log(`  vocab: ${vocabRaw.length}`);
  }

  // Dedup against existing
  const grammar = grammarRaw.filter(it => !existing.grammar.has(dedupKey(it.jp || it.reading)));
  const vocab   = vocabRaw.filter(it => !existing.vocab.has(dedupKey(it.jp || it.reading)));
  const dropG = grammarRaw.length - grammar.length;
  const dropV = vocabRaw.length - vocab.length;
  console.log(`  after dedup: ${grammar.length} grammar (-${dropG}), ${vocab.length} vocab (-${dropV})`);

  // Sample a few
  if (grammar.length > 0) console.log(`  e.g. grammar: ${(grammar[0].jp || `[PDF] ${grammar[0].reading}`).padEnd(20)} → ${grammar[0].en.slice(0, 40)}`);
  if (vocab.length > 0)   console.log(`  e.g. vocab:   ${(vocab[0].jp || vocab[0].reading).padEnd(20)} → ${vocab[0].en.slice(0, 40)}`);

  result[level] = { grammar, vocab };
  totalIn += grammarRaw.length + vocabRaw.length;
  totalOut += grammar.length + vocab.length;
  console.log("");
}

writeFileSync(OUTPUT, JSON.stringify(result, null, 2), "utf-8");
console.log(`Total: ${totalIn} parsed, ${totalOut} kept after dedup → ${OUTPUT}`);
console.log(`Breakdown:`);
for (const [lvl, d] of Object.entries(result)) {
  console.log(`  ${lvl}: ${d.grammar.length} grammar + ${d.vocab.length} vocab = ${d.grammar.length + d.vocab.length}`);
}
