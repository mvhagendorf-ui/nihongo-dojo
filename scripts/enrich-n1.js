// Enriches raw N1 items (jp/reading/en) with conn/ex/exHeb/heb/kanjiStory.
// Reads scripts/n1-raw.json (from parse-n1-html.js).
// Writes scripts/n1-enriched.json incrementally — safe to ctrl-C and resume.
//
// Hits the deployed /api/enrich-n1 endpoint (same pattern as precompute-radicals.js).
// No local API key needed — Vercel's env handles auth.
//
// Run:    node scripts/enrich-n1.js
// Resume: same command — already-enriched items are skipped.
// Limit:  LIMIT=10 node scripts/enrich-n1.js (test the prompt on 10 items first)
// Endpoint override: ENDPOINT=http://localhost:3000/api/enrich-n1 node scripts/enrich-n1.js

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const RAW = "scripts/n1-raw.json";
const OUT = "scripts/n1-enriched.json";
const ENDPOINT = process.env.ENDPOINT || "https://nihongo-dojo-topaz.vercel.app/api/enrich-n1";
const BATCH = 5;
const CONCURRENCY = 4;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

// ─── load ───
const raw = JSON.parse(readFileSync(RAW, "utf-8"));
const all = [
  ...raw.grammar.map(it => ({ ...it, _kind: "grammar" })),
  ...raw.vocab.map(it => ({ ...it, _kind: "vocab" })),
].slice(0, LIMIT);

let enriched = { grammar: [], vocab: [] };
const doneKeys = new Set();
if (existsSync(OUT)) {
  enriched = JSON.parse(readFileSync(OUT, "utf-8"));
  for (const it of enriched.grammar) doneKeys.add(`g:${rawKey(it.jp)}`);
  for (const it of enriched.vocab)   doneKeys.add(`v:${rawKey(it.jp)}`);
}

// Strip ALL ～ chars (the model adds them to grammar items, sometimes to multiple
// variants like "～ごとき/～ごとく") + any paren reading. This is the canonical key
// so dedup matches across raw/enriched regardless of decoration.
function rawKey(jp) {
  return jp.replace(/～/g, "").replace(/[（(][^)）]*[)）]/g, "").trim();
}

const todo = all.filter(it => !doneKeys.has(`${it._kind[0]}:${rawKey(it.jp)}`));
console.log(`${all.length} total · ${doneKeys.size} already enriched · ${todo.length} to do`);
console.log(`Endpoint: ${ENDPOINT}`);
if (todo.length === 0) { console.log("Nothing to do."); process.exit(0); }

const batches = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
console.log(`${batches.length} batches × ${BATCH} · concurrency ${CONCURRENCY}\n`);

// ─── batch processor ───
let done = 0;
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
          items: batch.map(({ jp, reading, en }) => ({ jp, reading, en })),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const items = data.items || [];
      if (items.length !== batch.length) {
        console.log(`  batch ${idx + 1}: ⚠ got ${items.length}, expected ${batch.length} — taking overlap`);
      }
      for (let i = 0; i < Math.min(items.length, batch.length); i++) {
        enriched[batch[i]._kind].push(items[i]);
      }
      const u = data.usage || {};
      totalIn += u.input_tokens || 0;
      totalOut += u.output_tokens || 0;
      totalCacheRead += u.cache_read_input_tokens || 0;
      totalCacheCreate += u.cache_creation_input_tokens || 0;
      done++;
      const ms = Date.now() - startedAt;
      const cacheTag = (u.cache_read_input_tokens || 0) > 0 ? " 💾" : "";
      console.log(`  batch ${idx + 1}/${batches.length} ✓ ${ms}ms · in:${u.input_tokens || 0} cache_r:${u.cache_read_input_tokens || 0} out:${u.output_tokens || 0}${cacheTag}`);
      writeFileSync(OUT, JSON.stringify(enriched, null, 2));
      return;
    } catch (e) {
      const msg = e.message || String(e);
      const isRate = msg.includes("429") || msg.includes("rate");
      const wait = isRate ? 30000 : 5000 * attempt;
      console.log(`  batch ${idx + 1}: ✗ attempt ${attempt} — ${msg}${attempt < 3 ? ` (retry in ${wait}ms)` : ""}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, wait));
    }
  }
  console.log(`  batch ${idx + 1}: GIVING UP after 3 attempts`);
}

// ─── pool ───
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
console.log(`\nDone in ${elapsed}s · ${enriched.grammar.length} grammar + ${enriched.vocab.length} vocab → ${OUT}`);
console.log(`Tokens — in:${totalIn} cache_r:${totalCacheRead} cache_w:${totalCacheCreate} out:${totalOut}`);
console.log(`Est cost: $${(inputCost + cacheReadCost + cacheCreateCost + outputCost).toFixed(2)}`);
