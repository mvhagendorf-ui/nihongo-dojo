// Enriches N5/N4/N3/N2 raw items via /api/enrich-n1 with mode:"jlpt"
// (no Hebrew, JP reconstruction for PDF entries).
//
// Reads scripts/jlpt-raw.json. Writes scripts/jlpt-enriched.json incrementally.
// Safe to ctrl-C and resume — already-enriched items are skipped.
//
// Run:    node scripts/enrich-jlpt.js
// Limit:  LIMIT=10 LEVEL=N5 KIND=grammar node scripts/enrich-jlpt.js  (smoke test)
// Levels: LEVEL=N5,N4,N3,N2 (default: all four)
// Kinds:  KIND=grammar,vocab (default: both)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const RAW = "scripts/jlpt-raw.json";
const OUT = "scripts/jlpt-enriched.json";
const ENDPOINT = process.env.ENDPOINT || "https://nihongo-dojo-topaz.vercel.app/api/enrich-n1";
const BATCH = 5;
const CONCURRENCY = 4;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const LEVELS = (process.env.LEVEL || "N5,N4,N3,N2").split(",");
const KINDS  = (process.env.KIND  || "grammar,vocab").split(",");

// ── load raw + existing enriched ──
const raw = JSON.parse(readFileSync(RAW, "utf-8"));

let enriched = {};
for (const lvl of ["N5", "N4", "N3", "N2"]) enriched[lvl] = enriched[lvl] || { grammar: [], vocab: [] };
const doneKeys = new Set();

if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, "utf-8"));
  for (const lvl of ["N5", "N4", "N3", "N2"]) {
    if (prev[lvl]) {
      enriched[lvl] = prev[lvl];
      for (const it of (prev[lvl].grammar || [])) doneKeys.add(`${lvl}:g:${rawKey(it.jp)}`);
      for (const it of (prev[lvl].vocab   || [])) doneKeys.add(`${lvl}:v:${rawKey(it.jp)}`);
    }
  }
}

// Strip ALL ～ chars + paren reading for canonical dedup key
function rawKey(jp) {
  return (jp || "").replace(/～/g, "").replace(/[（(][^)）]*[)）]/g, "").trim();
}
// For raw items, jp may be missing — fall back to reading
function rawSrcKey(it) {
  return rawKey(it.jp || it.reading);
}

// Build the todo list across selected levels/kinds
const todo = [];
for (const lvl of LEVELS) {
  for (const kind of KINDS) {
    const arr = raw[lvl]?.[kind] || [];
    for (const it of arr) {
      const key = `${lvl}:${kind[0]}:${rawSrcKey(it)}`;
      if (doneKeys.has(key)) continue;
      todo.push({ ...it, _level: lvl, _kind: kind });
    }
  }
}
const limited = todo.slice(0, LIMIT);

console.log(`Levels: ${LEVELS.join(",")} · Kinds: ${KINDS.join(",")} · Limit: ${LIMIT === Infinity ? "none" : LIMIT}`);
console.log(`${todo.length} items pending · ${doneKeys.size} already done · ${limited.length} this run`);
console.log(`Endpoint: ${ENDPOINT}`);
if (limited.length === 0) { console.log("Nothing to do."); process.exit(0); }

const batches = [];
for (let i = 0; i < limited.length; i += BATCH) batches.push(limited.slice(i, i + BATCH));
console.log(`${batches.length} batches × ${BATCH} · concurrency ${CONCURRENCY}\n`);

// ── batch processor ──
let completed = 0;
const t0 = Date.now();
let totalIn = 0, totalOut = 0, totalCacheRead = 0, totalCacheCreate = 0;

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
          mode: "jlpt",
          items: batch.map((it) => ({
            ...(it.jp ? { jp: it.jp } : {}),
            reading: it.reading,
            en: it.en,
            level: it._level,
            ...(it.exRomaji ? { exRomaji: it.exRomaji } : {}),
            ...(it.exEn ? { exEn: it.exEn } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const items = data.items || [];
      if (items.length !== batch.length) {
        console.log(`  batch ${idx + 1}: ⚠ got ${items.length}, expected ${batch.length}`);
      }
      for (let i = 0; i < Math.min(items.length, batch.length); i++) {
        const enrichedItem = items[i];
        const lvl = batch[i]._level;
        const kind = batch[i]._kind;
        // Use level from response if present (it should be), else fall back to source level
        const targetLvl = enrichedItem.level || lvl;
        if (!enriched[targetLvl]) enriched[targetLvl] = { grammar: [], vocab: [] };
        enriched[targetLvl][kind].push(enrichedItem);
      }
      const u = data.usage || {};
      totalIn += u.input_tokens || 0;
      totalOut += u.output_tokens || 0;
      totalCacheRead += u.cache_read_input_tokens || 0;
      totalCacheCreate += u.cache_creation_input_tokens || 0;
      completed++;
      const ms = Date.now() - startedAt;
      const cacheTag = (u.cache_read_input_tokens || 0) > 0 ? " 💾" : "";
      console.log(`  batch ${idx + 1}/${batches.length} ✓ ${ms}ms · in:${u.input_tokens || 0} cache_r:${u.cache_read_input_tokens || 0} out:${u.output_tokens || 0}${cacheTag}`);
      writeFileSync(OUT, JSON.stringify(enriched, null, 2));
      return;
    } catch (e) {
      const msg = e.message || String(e);
      const isRate = msg.includes("429") || msg.includes("rate");
      const wait = isRate ? 30000 : 5000 * attempt;
      console.log(`  batch ${idx + 1}: ✗ attempt ${attempt} — ${msg.slice(0, 150)}${attempt < 3 ? ` (retry in ${wait}ms)` : ""}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.log(`  batch ${idx + 1}: GIVING UP after 3 attempts`);
}

// ── pool ──
const queue = batches.map((b, i) => ({ b, i }));
const workers = Array(CONCURRENCY).fill(0).map(async () => {
  while (queue.length > 0) {
    const { b, i } = queue.shift();
    await processBatch(b, i);
  }
});
await Promise.all(workers);

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const inputCost = (totalIn / 1_000_000) * 3;
const cacheReadCost = (totalCacheRead / 1_000_000) * 0.30;
const cacheCreateCost = (totalCacheCreate / 1_000_000) * 3.75;
const outputCost = (totalOut / 1_000_000) * 15;
console.log(`\nDone in ${elapsed}s. Tally:`);
for (const lvl of ["N5", "N4", "N3", "N2"]) {
  console.log(`  ${lvl}: ${enriched[lvl].grammar.length} grammar + ${enriched[lvl].vocab.length} vocab`);
}
console.log(`Tokens — in:${totalIn} cache_r:${totalCacheRead} cache_w:${totalCacheCreate} out:${totalOut}`);
console.log(`Est cost this run: $${(inputCost + cacheReadCost + cacheCreateCost + outputCost).toFixed(2)}`);
