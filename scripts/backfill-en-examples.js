// Backfills exEn (English example translation) for items in public's data.js
// that have `ex:` but no `exEn:`. Used after the N1 enrichment, since N1 items
// were originally enriched without exEn (heb-only).
//
// Reads ../nihongo-dojo-public/src/data.js, finds items with ex but no exEn,
// sends batches to /api/enrich-n1 (jlpt mode, translation-only), and rewrites
// data.js in place.
//
// Run: node scripts/backfill-en-examples.js
// Limit: LIMIT=10 ... (test on first 10)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DATA = "../nihongo-dojo-public/src/data.js";
const ENDPOINT = process.env.ENDPOINT || "https://nihongo-dojo-topaz.vercel.app/api/translate-example";
const BATCH = 10;
const CONCURRENCY = 4;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

if (!existsSync(DATA)) { console.error(`ERROR: ${DATA} not found`); process.exit(1); }

let txt = readFileSync(DATA, "utf-8");

// Find items with ex but no exEn — match each item literal { ... } that contains ex: but not exEn:
const itemRe = /\{[^{}]*?\bex:\s*"([^"]+)"[^{}]*?\}/g;
const todo = [];
let m;
while ((m = itemRe.exec(txt)) !== null) {
  const literal = m[0];
  if (literal.includes("exEn:")) continue;
  // Extract jp + ex
  const jpM = literal.match(/\bjp:\s*"([^"]+)"/);
  const enM = literal.match(/\ben:\s*"([^"]+)"/);
  if (!jpM || !enM) continue;
  todo.push({ jp: jpM[1], ex: m[1], en: enM[1], literal });
}
console.log(`Found ${todo.length} items needing exEn backfill`);
const limited = todo.slice(0, LIMIT);
if (limited.length === 0) { console.log("Nothing to do."); process.exit(0); }

const batches = [];
for (let i = 0; i < limited.length; i += BATCH) batches.push(limited.slice(i, i + BATCH));
console.log(`${batches.length} batches × ${BATCH} · concurrency ${CONCURRENCY}\n`);

let totalIn = 0, totalOut = 0;
const t0 = Date.now();

// Map jp+ex → exEn (allows safe replace even if same jp appears multiple times w/ different ex)
const translations = new Map();

async function processBatch(batch, idx) {
  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    const startedAt = Date.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: batch.map(({ jp, ex, en }) => ({ jp, ex, en })),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      const items = data.items || [];
      for (let i = 0; i < Math.min(items.length, batch.length); i++) {
        const exEn = items[i].exEn;
        if (exEn) translations.set(`${batch[i].jp}|||${batch[i].ex}`, exEn);
      }
      const u = data.usage || {};
      totalIn += u.input_tokens || 0;
      totalOut += u.output_tokens || 0;
      const ms = Date.now() - startedAt;
      console.log(`  batch ${idx + 1}/${batches.length} ✓ ${ms}ms · ${items.length}/${batch.length} translated`);
      return;
    } catch (e) {
      const wait = 5000 * attempt;
      console.log(`  batch ${idx + 1}: ✗ attempt ${attempt} — ${(e.message || e).slice(0, 150)}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, wait));
    }
  }
}

const queue = batches.map((b, i) => ({ b, i }));
const workers = Array(CONCURRENCY).fill(0).map(async () => {
  while (queue.length > 0) {
    const { b, i } = queue.shift();
    await processBatch(b, i);
  }
});
await Promise.all(workers);

console.log(`\nGot ${translations.size} translations. Rewriting data.js...`);

// Rewrite data.js: for each item literal needing exEn, inject it after ex: "..."
let rewriteCount = 0;
const itemRe2 = /\{[^{}]*?\bjp:\s*"([^"]+)"[^{}]*?\bex:\s*"([^"]+)"[^{}]*?\}/g;
txt = txt.replace(itemRe2, (literal, jp, ex) => {
  if (literal.includes("exEn:")) return literal;
  const exEn = translations.get(`${jp}|||${ex}`);
  if (!exEn) return literal;
  // Inject exEn right after ex: "..." with proper escaping
  const exEnLiteral = `, exEn: ${JSON.stringify(exEn)}`;
  const out = literal.replace(/(\bex:\s*"[^"]+")/, `$1${exEnLiteral}`);
  rewriteCount++;
  return out;
});

writeFileSync(DATA, txt, "utf-8");
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`✓ Rewrote ${rewriteCount} items in ${DATA}`);
console.log(`Tokens — in:${totalIn} out:${totalOut}`);
console.log(`Cost: ~$${((totalIn/1_000_000)*0.80 + (totalOut/1_000_000)*4).toFixed(2)} (haiku 4.5)`);
console.log(`Done in ${elapsed}s.`);
