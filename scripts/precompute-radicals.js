// One-shot script: extracts every kanji used in src/data.js, calls the deployed
// /api/decompose-kanji endpoint in batches, and writes the results to
// src/kanjiRadicals.json so the bundled app can serve them with zero latency.
//
// Run: node scripts/precompute-radicals.js
//
// Optional: ENDPOINT env var to override the production endpoint, e.g.
//   ENDPOINT=http://localhost:3000/api/decompose-kanji node scripts/precompute-radicals.js

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENDPOINT = process.env.ENDPOINT || "https://nihongo-dojo-topaz.vercel.app/api/decompose-kanji";
const OUTPUT = "src/kanjiRadicals.json";
const BATCH = 15;
const CONCURRENCY = 3;
const KANJI_RE = /[㐀-䶿一-龯豈-﫿]/g;

const dataText = readFileSync("src/data.js", "utf-8");
const allKanji = dataText.match(KANJI_RE) || [];
const unique = [...new Set(allKanji)].sort();
console.log(`Found ${unique.length} unique kanji in src/data.js`);

let existing = {};
if (existsSync(OUTPUT)) {
  try { existing = JSON.parse(readFileSync(OUTPUT, "utf-8")); } catch {}
}
const missing = unique.filter(k => !existing[k]);
console.log(`${Object.keys(existing).length} already cached · ${missing.length} to fetch`);

if (missing.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

const results = { ...existing };
const batches = [];
for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));
console.log(`${batches.length} batches × ${BATCH} kanji · concurrency ${CONCURRENCY}`);

let completed = 0;
const t0 = Date.now();

async function processBatch(batch, idx) {
  const startedAt = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanjis: batch }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.log(`  batch ${idx + 1}/${batches.length} ✗ HTTP ${res.status}: ${err.slice(0, 120)}`);
      return;
    }
    const data = await res.json();
    let added = 0;
    for (const d of data.decompositions || []) {
      if (d?.kanji) {
        results[d.kanji] = { radicals: d.radicals || [], mnemonic: d.mnemonic || "" };
        added++;
      }
    }
    completed++;
    const ms = Date.now() - startedAt;
    const total = Object.keys(results).length;
    console.log(`  batch ${idx + 1}/${batches.length} ✓ +${added} (${ms}ms) — total ${total}/${unique.length}`);
    writeFileSync(OUTPUT, JSON.stringify(results, null, 0));
  } catch (e) {
    console.log(`  batch ${idx + 1}/${batches.length} ✗ ${e.message || e}`);
  }
}

// Run a sliding pool of CONCURRENCY workers.
async function runPool() {
  const queue = batches.map((b, i) => ({ b, i }));
  const workers = Array(CONCURRENCY).fill(0).map(async () => {
    while (queue.length > 0) {
      const { b, i } = queue.shift();
      await processBatch(b, i);
    }
  });
  await Promise.all(workers);
}

await runPool();
writeFileSync(OUTPUT, JSON.stringify(results, null, 0));
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s · ${Object.keys(results).length} entries → ${OUTPUT}`);
