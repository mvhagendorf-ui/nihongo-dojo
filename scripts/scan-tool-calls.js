// Scans all Claude Code transcripts in both project dirs, extracts tool-call
// frequencies (Bash + MCP), and prints a sorted summary.
// Used by the /fewer-permission-prompts skill.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASES = [
  "C:/Users/mvhag/.claude/projects/C--Users-mvhag-nihongo-dojo",
  "C:/Users/mvhag/.claude/projects/C--Users-mvhag-Documents-work",
];

// Find all jsonl files, sort by mtime desc, cap at 50
const files = [];
for (const base of BASES) {
  try {
    const names = readdirSync(base);
    for (const n of names) {
      if (!n.endsWith(".jsonl")) continue;
      const p = join(base, n);
      const stat = statSync(p);
      files.push({ path: p, mtime: stat.mtimeMs });
    }
  } catch (e) { /* dir doesn't exist */ }
}
files.sort((a, b) => b.mtime - a.mtime);
const recent = files.slice(0, 50);
console.error(`Scanning ${recent.length} transcripts...`);

// Parse out the leading command from a Bash invocation, handling sudo, env vars,
// pipes, and chains. Returns the command + first arg (e.g. "git status").
function parseBashKey(cmdRaw) {
  let cmd = (cmdRaw || "").trim();
  // Pull off env-var assignments: FOO=bar BAR=baz <cmd>
  while (/^[A-Z_][A-Z0-9_]*=\S+\s/.test(cmd)) cmd = cmd.replace(/^\S+\s+/, "");
  // Drop sudo / timeout prefixes
  cmd = cmd.replace(/^(sudo|timeout\s+\S+)\s+/, "");
  // Take everything before pipe / && / || / ; / >
  cmd = cmd.split(/\s*(?:\||&&|\|\||;|>)\s*/)[0].trim();
  // Tokenize
  const tokens = cmd.split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) return null;
  const head = tokens[0];
  // For multi-word commands like "git status", "gh pr view", grab 1-2 subcommands
  const sub = tokens[1] || "";
  const sub2 = tokens[2] || "";
  // Skip if sub starts with a flag/path
  const isFlag = (s) => s.startsWith("-") || s.startsWith("/") || s.startsWith("'") || s.startsWith('"') || s.startsWith("$");
  if (sub && !isFlag(sub)) {
    if (head === "gh" && sub2 && !isFlag(sub2)) return `${head} ${sub} ${sub2}`;
    return `${head} ${sub}`;
  }
  return head;
}

const counts = new Map(); // key -> { kind, count, examples: Set }
function record(kind, key, sample) {
  if (!key) return;
  const k = `${kind}|${key}`;
  if (!counts.has(k)) counts.set(k, { kind, key, count: 0, examples: new Set() });
  const e = counts.get(k);
  e.count++;
  if (sample && e.examples.size < 3) e.examples.add(sample);
}

let totalLines = 0, totalToolUses = 0;
for (const { path } of recent) {
  let txt;
  try { txt = readFileSync(path, "utf-8"); } catch (e) { continue; }
  for (const line of txt.split("\n")) {
    if (!line.trim()) continue;
    totalLines++;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== "assistant") continue;
    const content = obj.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      totalToolUses++;
      const name = block.name;
      const input = block.input || {};
      if (name === "Bash") {
        const key = parseBashKey(input.command);
        record("Bash", key, (input.command || "").slice(0, 80));
      } else if (name && name.startsWith("mcp__")) {
        record("MCP", name, "");
      } else {
        record("Built-in", name, "");
      }
    }
  }
}

console.error(`Parsed ${totalLines} lines, ${totalToolUses} tool uses.\n`);

const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
for (const e of sorted) {
  if (e.count < 2) break;
  const ex = [...e.examples].slice(0, 1).join(" | ").replace(/\s+/g, " ").slice(0, 70);
  console.log(`${e.count.toString().padStart(4)} ${e.kind.padEnd(8)} ${e.key.padEnd(36)} ${ex ? "  e.g. " + ex : ""}`);
}
