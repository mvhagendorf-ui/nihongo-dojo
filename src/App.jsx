import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { CATEGORIES, CATEGORY_GROUPS, SIM_GROUPS, ALL_DATA, PASS_SCORE, QUESTIONS_PER_TEST, TIMER_SECONDS } from "./data";
import { playSound } from "./audio";
import { loadHistory, saveSession, updateSRS, getSRSWeights, loadSRS, loadBookmarks, saveBookmarks, loadCustomQuizzes, saveCustomQuizzes } from "./storage";
import { cloudEnabled, getSession, signIn, signUp, signOut, onAuthChange, fetchCloud, scheduleSync, mergeSRS, mergeHistory, mergeBookmarks } from "./cloud";

// ─────────── DESIGN TOKENS ───────────
const C = {
  bg: "#F1F1F3",
  surface: "#FFFFFF",
  elevated: "#F8F4EB",
  mutedBg: "#E8E1CD",
  border: "#E2E1E5",
  borderStrong: "#BCBBC2",
  ink: "#141414",
  inkDim: "#3F3F3F",
  muted: "#7A7468",
  faint: "#A8A294",
  accent: "#BC002D",
  accentHi: "#D91840",
  accentSoft: "rgba(188,0,45,0.08)",
  accentLine: "rgba(188,0,45,0.28)",
  pass: "#0F8F47",
  passSoft: "rgba(15,143,71,0.08)",
  passLine: "rgba(15,143,71,0.28)",
  fail: "#BC002D",
  kanji: "#7C3AED",
};

const FONT_LATIN = "'Inter', system-ui, sans-serif";
const FONT_JP = "'Noto Sans JP', 'Hiragino Sans', sans-serif";
const FONT_JP_DISPLAY = "'Noto Serif JP', 'Noto Sans JP', serif";
const FONT_NUM = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const KICKER = { fontFamily: FONT_LATIN, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11, color: C.muted };
const JP_LABEL = { fontFamily: FONT_JP, fontSize: 14, fontWeight: 700, color: C.faint, letterSpacing: "0.04em", textTransform: "none" };

// ─────────── ICONS (2px stroke) ───────────
const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const IconVolume  = (p) => <Icon {...p} d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>} />;
const IconClock   = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>} />;
const IconFlame   = (p) => <Icon {...p} d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1.5 1-3 1-3s-3 1-3 5a6 6 0 0 0 12 0c0-5-6-10-6-10z" />;
const IconCheck   = (p) => <Icon {...p} d="M20 6 9 17l-5-5" />;
const IconX       = (p) => <Icon {...p} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />;
const IconBook    = (p) => <Icon {...p} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h14" />;
const IconChart   = (p) => <Icon {...p} d={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></>} />;
const IconTrophy  = (p) => <Icon {...p} d={<><path d="M6 4h12v4a6 6 0 0 1-12 0V4z"/><path d="M4 4h2v3a2 2 0 0 1-2-2V4z"/><path d="M20 4h-2v3a2 2 0 0 0 2-2V4z"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="14" x2="12" y2="20"/></>} />;
const IconChevDn  = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
const IconChevRt  = (p) => <Icon {...p} d="M9 6l6 6-6 6" />;
const IconArrowL  = (p) => <Icon {...p} d={<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>} />;
const IconPencil  = (p) => <Icon {...p} d={<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></>} />;
const IconBrain   = (p) => <Icon {...p} d="M9 4a3 3 0 0 1 3 3v10a3 3 0 0 1-6 0 3 3 0 0 1-2-3 3 3 0 0 1 1-5 3 3 0 0 1 4-5zM15 4a3 3 0 0 0-3 3v10a3 3 0 0 0 6 0 3 3 0 0 0 2-3 3 3 0 0 0-1-5 3 3 0 0 0-4-5z" />;
const IconStar    = ({ filled, ...p }) => <Icon {...p} fill={filled ? "currentColor" : "none"} d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />;
const IconUser    = (p) => <Icon {...p} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />;
const IconCloud   = (p) => <Icon {...p} d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />;
const IconLogOut  = (p) => <Icon {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />;

// ─────────── HOOKS & HELPERS ───────────
function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 880);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const handler = (e) => setWide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return wide;
}

const hasKanji = (jp) => /[一-鿿]/.test(jp || "");
const storyLabel = (jp) => hasKanji(jp) ? "Kanji Story" : "Etymology";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedShuffle(items, count) {
  const weighted = getSRSWeights(items);
  const picked = [];
  const pool = [...weighted];
  while (picked.length < Math.min(count, items.length) && pool.length > 0) {
    const totalWeight = pool.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    picked.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return picked;
}

// Strips `（kana）` reading from a jp string. "お越しになる（おこしになる）" → { jp: "お越しになる", reading: "おこしになる" }
function parseJpReading(rawJp) {
  if (!rawJp) return { jp: "", reading: null };
  const m = rawJp.match(/^(.*?)\s*[（(]([^)）]+)[)）]\s*$/);
  if (m && /^[぀-ゟ゠-ヿ〜ー・]+$/.test(m[2].trim())) {
    return { jp: m[1].trim(), reading: m[2].trim() };
  }
  return { jp: rawJp, reading: null };
}
const isKanjiChar = (ch) => /[㐀-䶿一-龯豈-﫿]/.test(ch);

// Aligns kanji blocks in jp with their reading from the kana-only reading string.
// Returns segments: { type: "plain" | "ruby", text? , kanji? , reading? }
function buildFuriganaSegments(jp, reading) {
  if (!reading || reading === jp) return [{ type: "plain", text: jp }];
  const segments = [];
  let i = 0, j = 0;
  while (i < jp.length) {
    const ch = jp[i];
    if (!isKanjiChar(ch)) {
      segments.push({ type: "plain", text: ch });
      i++;
      if (reading[j] === ch) j++;
      continue;
    }
    let end = i;
    while (end < jp.length && isKanjiChar(jp[end])) end++;
    const kanjiBlock = jp.slice(i, end);
    const nextChar = end < jp.length ? jp[end] : null;
    let readingEnd;
    if (nextChar === null) readingEnd = reading.length;
    else {
      readingEnd = reading.indexOf(nextChar, j);
      if (readingEnd === -1) readingEnd = reading.length;
    }
    const blockReading = reading.slice(j, readingEnd);
    if (blockReading) segments.push({ type: "ruby", kanji: kanjiBlock, reading: blockReading });
    else segments.push({ type: "plain", text: kanjiBlock });
    i = end;
    j = readingEnd;
  }
  return segments;
}

function Furigana({ jp, reading, style, className }) {
  const parsed = parseJpReading(jp);
  const finalJp = parsed.jp;
  const finalReading = reading || parsed.reading;
  const segments = buildFuriganaSegments(finalJp, finalReading);
  return (
    <span className={className} style={style}>
      {segments.map((seg, idx) =>
        seg.type === "plain"
          ? <span key={idx}>{seg.text}</span>
          : <ruby key={idx}>{seg.kanji}<rt style={{ fontSize: "0.42em", fontWeight: 400, lineHeight: 1, color: "inherit", letterSpacing: "0", opacity: 0.85 }}>{seg.reading}</rt></ruby>
      )}
    </span>
  );
}

// Strips a parenthetical reading off jp, for places that just want the clean text (TTS, comparisons display)
function cleanJp(jp) { return parseJpReading(jp).jp; }

// Strips ALL inline `（kana）` annotations from a string (for TTS — otherwise the engine reads them aloud).
function stripFurigana(text) {
  if (!text) return text;
  return text.replace(/[（(]([぀-ゟ゠-ヿ〜ー・]+)[)）]/g, "");
}

// Per-kanji radical decomposition. Three sources, in order:
//   1. BUNDLED_RADICALS — pre-computed JSON shipped with the app (instant, zero API cost)
//   2. localStorage cache — for kanji fetched at runtime (custom quizzes, new MY_WORDS)
//   3. /api/decompose-kanji — fallback for anything not yet cached
import BUNDLED_RADICALS from "./kanjiRadicals.json";
const RADICAL_CACHE_KEY = "nihongo_dojo_kanji_radicals_v2";
function loadRadicalCache() {
  try { return JSON.parse(localStorage.getItem(RADICAL_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function saveRadicalCache(cache) {
  try {
    localStorage.setItem(RADICAL_CACHE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent("radical-cache-updated"));
  } catch {}
}
function getRadicalEntry(k) {
  return BUNDLED_RADICALS[k] || loadRadicalCache()[k] || null;
}

// Kicks off background prefetch of any uncached kanji from a list of jp strings.
// Call at quiz start so radicals land in cache while the user works through questions.
function prefetchRadicalsForJp(jpStrings) {
  const need = new Set();
  for (const jp of jpStrings) {
    if (!jp) continue;
    for (const ch of jp) if (isKanjiChar(ch) && !getRadicalEntry(ch)) need.add(ch);
  }
  if (need.size === 0) return;
  const all = [...need];
  // Batch into chunks of 15 (matches API ceiling); fire all in parallel.
  for (let i = 0; i < all.length; i += 15) {
    const chunk = all.slice(i, i + 15);
    fetch("/api/decompose-kanji", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanjis: chunk }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.decompositions) return;
        const next = { ...loadRadicalCache() };
        for (const d of data.decompositions) {
          if (d?.kanji) next[d.kanji] = { radicals: d.radicals || [], mnemonic: d.mnemonic || "" };
        }
        saveRadicalCache(next);
      })
      .catch(() => {});
  }
}

// Per-kanji radical tile grid — reads from BUNDLED_RADICALS first, then localStorage cache,
// then fetches missing ones from /api/decompose-kanji on demand.
function KanjiRadicals({ word }) {
  const kanjiList = useMemo(() => {
    if (!word) return [];
    const set = new Set();
    for (const ch of word) if (isKanjiChar(ch)) set.add(ch);
    return [...set];
  }, [word]);

  // Resolve current entries from bundled + localStorage cache. Re-resolves whenever the cache fires its update event.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener("radical-cache-updated", handler);
    return () => window.removeEventListener("radical-cache-updated", handler);
  }, []);

  const entries = useMemo(() => {
    const lsCache = loadRadicalCache();
    const out = {};
    for (const k of kanjiList) {
      out[k] = BUNDLED_RADICALS[k] || lsCache[k] || null;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanjiList.join(","), version]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (kanjiList.length === 0) return;
    const missing = kanjiList.filter(k => !entries[k]);
    if (missing.length === 0) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/decompose-kanji", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanjis: missing }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const next = { ...loadRadicalCache() };
        for (const d of data.decompositions || []) {
          if (d?.kanji) next[d.kanji] = { radicals: d.radicals || [], mnemonic: d.mnemonic || "" };
        }
        saveRadicalCache(next);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanjiList.join(",")]);

  if (kanjiList.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...KICKER, color: C.kanji, fontSize: 10, marginBottom: 8 }}>Components · 部首</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {kanjiList.map(k => {
          const entry = entries[k];
          return (
            <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, fontFamily: FONT_JP_DISPLAY, color: "#5B21B6", fontWeight: 500, lineHeight: 1, minWidth: 36, textAlign: "center" }}>{k}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {entry ? (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {entry.radicals.map((r, i) => (
                        <div key={i} style={{ background: C.surface, border: `1px solid rgba(124,58,237,0.25)`, borderRadius: 7, padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 20, fontFamily: FONT_JP_DISPLAY, color: "#5B21B6", lineHeight: 1 }}>{r.char}</span>
                          <span style={{ fontSize: 11, color: C.inkDim, fontWeight: 500 }}>{r.meaning}</span>
                          {typeof r.strokes === "number" && <span style={{ fontSize: 10, color: C.faint, fontFamily: FONT_NUM }}>{r.strokes}画</span>}
                        </div>
                      ))}
                    </div>
                    {entry.mnemonic && (
                      <div style={{
                        fontSize: 13, color: "#5B21B6", marginTop: 8,
                        fontWeight: 600, lineHeight: 1.5,
                        background: "rgba(124,58,237,0.06)",
                        border: "1px solid rgba(124,58,237,0.18)",
                        borderRadius: 6, padding: "6px 10px",
                        display: "inline-block",
                      }}>
                        → {entry.mnemonic}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", paddingTop: 6 }}>{loading ? "Decomposing…" : "—"}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Renders a sentence with inline `（kana）` annotations as <ruby> furigana over the preceding kanji block.
// "健康診断（しんだん）の結果は頗る良好（りょうこう）だ" → ruby above 健康診断 / 良好.
function FuriganaSentence({ text }) {
  if (!text) return null;
  const re = /([㐀-䶿一-龯豈-﫿]+)[（(]([぀-ゟ゠-ヿ〜ー・]+)[)）]/g;
  const out = [];
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    out.push(
      <ruby key={key++}>{m[1]}<rt style={{ fontSize: "0.5em", fontWeight: 400, lineHeight: 1, color: "inherit", letterSpacing: 0, opacity: 0.85 }}>{m[2]}</rt></ruby>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={key++}>{text.slice(last)}</span>);
  return <>{out}</>;
}

function extractCores(jp) {
  const cleaned = jp.replace(/^～/, "").replace(/[（(][^)）]*[)）]/g, "").trim();
  return cleaned.split("/").map(s => s.trim()).filter(Boolean);
}
function findCoreInEx(ex, cores) {
  if (!ex) return null;
  const sorted = [...cores].sort((a, b) => b.length - a.length);
  for (const core of sorted) if (core.length >= 2 && ex.includes(core)) return core;
  return null;
}
function canFillBlank(q) {
  if (!q.ex) return false;
  return findCoreInEx(q.ex, extractCores(q.jp)) !== null;
}
function blankExample(ex, core) { return ex.replace(core, "＿＿＿"); }
function pickQuestionType(q) {
  if (canFillBlank(q) && Math.random() < 0.4) return "fillBlank";
  return "meaning";
}

function generateChoices(q, pool) {
  if (q._type === "fillBlank") {
    const sameCat = pool.filter(d => d.jp !== q.jp && d.cat === q.cat && canFillBlank(d));
    let candidates = shuffle(sameCat).slice(0, 3);
    if (candidates.length < 3) {
      const extra = shuffle(pool.filter(d => d.jp !== q.jp && canFillBlank(d) && !candidates.find(c => c.jp === d.jp)));
      candidates = [...candidates, ...extra.slice(0, 3 - candidates.length)];
    }
    return shuffle([q, ...candidates]);
  }
  let simItems = [];
  for (const grp of Object.values(SIM_GROUPS)) {
    if (grp.some(g => q.jp.includes(g) || g.includes(q.jp.replace("～", "")))) {
      simItems = pool.filter(d => d.jp !== q.jp && grp.some(g => d.jp.includes(g) || g.includes(d.jp.replace("～", ""))));
      break;
    }
  }
  const sameCat = pool.filter(d => d.jp !== q.jp && d.cat === q.cat);
  let candidates = shuffle([...simItems]);
  if (candidates.length < 3)
    candidates = [...candidates, ...shuffle(sameCat.filter(d => !candidates.find(c => c.jp === d.jp)))];
  if (candidates.length < 3)
    candidates = [...candidates, ...shuffle(pool.filter(d => d.jp !== q.jp && !candidates.find(c => c.jp === d.jp)))];
  return shuffle([q, ...candidates.slice(0, 3)]);
}

function formatTime(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; }

// TTS
let jaVoice = null;
function initVoices() {
  const voices = speechSynthesis.getVoices();
  const ja = voices.filter(v => v.lang.startsWith("ja"));
  jaVoice = ja.find(v => /google|premium|enhanced/i.test(v.name)) || ja.find(v => !v.localService) || ja[0] || null;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  initVoices();
  speechSynthesis.addEventListener("voiceschanged", initVoices);
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP"; u.rate = 0.85; u.pitch = 1.05;
  if (jaVoice) u.voice = jaVoice;
  speechSynthesis.speak(u);
}

function SpeakBtn({ text, size = 14 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); speak(text); }} aria-label="Play audio" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, verticalAlign: "middle" }} className="btn-hover" onMouseEnter={e => e.currentTarget.style.color = C.ink} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
      <IconVolume size={size} />
    </button>
  );
}

function HebText({ children, style }) {
  return <div className="heb" style={style}>{children}</div>;
}

// Connection-rule color coding — vivid pills tuned for dark theme
const CONN_COLORS = [
  { pattern: /V[るない可能意向条件]|Vた形|Vます形|Vて形|Vた\+|V辞書形|V普通形|V(?=[てもたる＋])/g, color: "#2563EB", bg: "rgba(37,99,235,0.10)" },   // Verb → blue
  { pattern: /N(?![0-9a-zA-Z])/g,                                                                     color: "#16A34A", bg: "rgba(22,163,74,0.10)" },   // Noun → green
  { pattern: /い形[容詞a-z]*/g,                                                                       color: "#EA580C", bg: "rgba(234,88,12,0.10)" },   // i-adj → orange
  { pattern: /な形[容詞a-z]*/g,                                                                       color: "#C026D3", bg: "rgba(192,38,211,0.10)" },  // na-adj → pink
  { pattern: /普通形[（(][^)）]*[)）]?/g,                                                              color: "#0891B2", bg: "rgba(8,145,178,0.10)" },   // plain → teal
  { pattern: /普通形/g,                                                                              color: "#0891B2", bg: "rgba(8,145,178,0.10)" },   // plain → teal
  { pattern: /尊敬語|謙譲語/g,                                                                        color: "#7C3AED", bg: "rgba(124,58,237,0.10)" },  // honorific → purple
  { pattern: /助数詞/g,                                                                              color: "#B45309", bg: "rgba(180,83,9,0.10)" },    // counter → amber
  { pattern: /疑問詞/g,                                                                              color: "#0891B2", bg: "rgba(8,145,178,0.10)" },   // question word → teal
];

// Glossary used for hover popovers and (for N5/N4) inline English labels.
const CONN_GLOSSARY = {
  "V":        { short: "Verb",          desc: "A verb — an action or state word.",                                example: "食べる, 行く, する" },
  "N":        { short: "Noun",          desc: "A noun — a person, thing, place, or idea.",                        example: "学生, 本, 東京" },
  "い形":     { short: "i-Adjective",   read: "けい", desc: "A regular adjective ending in い.",                  example: "高い, 寒い, 美味しい" },
  "な形":     { short: "na-Adjective",  read: "けい", desc: "An adjective that takes な before a noun.",          example: "静か(な), 元気(な)" },
  "Vる":      { short: "Verb·plain",    desc: "Verb in plain dictionary form (ru-ending shown).",                  example: "食べる, 行く" },
  "Vない":    { short: "Verb·negative", desc: "Verb negative-stem form.",                                          example: "食べない, 行かない" },
  "Vた":      { short: "Verb·past",     desc: "Verb in plain past form (-ta).",                                    example: "食べた, 行った" },
  "Vて":      { short: "Verb·te-form",  desc: "Verb in te-form — used to connect verbs/clauses.",                  example: "食べて, 行って" },
  "Vた形":    { short: "Past form",     read: "けい", desc: "Plain past form of a verb.",                         example: "食べた, 行った, 飲んだ" },
  "Vて形":    { short: "te-Form",       read: "けい", desc: "Connecting form using て / で.",                     example: "食べて, 飲んで, 行って" },
  "Vます形":  { short: "Polite stem",   read: "けい", desc: "Verb stem before ます (the verb minus -masu).",      example: "食べ(ます), 行き(ます)" },
  "V辞書形":  { short: "Dictionary form", read: "じしょけい", desc: "Verb in plain dictionary form.",             example: "食べる, 行く, 来る, する" },
  "V普通形":  { short: "Plain form",    read: "ふつうけい", desc: "Verb in any plain (non-polite) conjugation.",  example: "食べる, 食べた, 食べない" },
  "V可能":    { short: "Potential",     desc: "Potential / 'can do' form.",                                        example: "食べられる, 行ける" },
  "V意向":    { short: "Volitional",    desc: "'Let's …' / volitional form.",                                      example: "食べよう, 行こう" },
  "V条件":    { short: "Conditional",   desc: "If / conditional form.",                                            example: "食べれば, 行けば" },
  "普通形":   { short: "Plain form",    read: "ふつうけい", desc: "Plain (non-polite) conjugation — used for verbs, adjectives, and copula.", example: "食べる, 食べた, 食べない, 高い, 静かだ" },
  "尊敬語":   { short: "Respectful",    read: "そんけいご", desc: "Honorific speech — elevates the listener / subject.", example: "いらっしゃる, ご覧になる" },
  "謙譲語":   { short: "Humble",        read: "けんじょうご", desc: "Humble speech — lowers oneself relative to the listener.", example: "申す, 拝見する, いたす" },
  "助数詞":   { short: "Counter",       read: "じょすうし", desc: "Counter word for nouns.",                       example: "三本, 二個, 五人" },
  "疑問詞":   { short: "Question word", read: "ぎもんし", desc: "Interrogative word.",                             example: "何, 誰, どこ, いつ" },
};
const INLINE_LABEL_TOKENS = new Set(["V", "N", "い形", "な形"]);
function isBeginnerCat(cat) { return typeof cat === "string" && (cat.startsWith("N5") || cat.startsWith("N4")); }

function lookupConn(token) {
  if (CONN_GLOSSARY[token]) return CONN_GLOSSARY[token];
  const base = token.replace(/[（(].*$/, "");
  return CONN_GLOSSARY[base] || null;
}

function ConnToken({ token, color, bg, beginner }) {
  const info = lookupConn(token);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onEsc); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);

  // Compute portal position from the trigger's viewport rect, choosing top/bottom based on space
  const showPopover = (e) => {
    if (!info || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const popHeight = 140; // approximate
    const placeBelow = r.bottom + popHeight + 8 < window.innerHeight;
    setPos({
      placement: placeBelow ? "below" : "above",
      top: placeBelow ? r.bottom + 8 : r.top - 8,
      left: r.left + r.width / 2,
    });
    setOpen(true);
  };
  const hidePopover = () => setOpen(false);

  const tokenContent = info?.read
    ? <ruby>{token}<rt style={{ fontSize: "0.55em", fontWeight: 500 }}>{info.read}</rt></ruby>
    : token;

  const showInline = beginner && info && INLINE_LABEL_TOKENS.has(token);

  return (
    <span
      ref={ref}
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
      onClick={(e) => { if (!info) return; e.stopPropagation(); if (open) hidePopover(); else showPopover(); }}
      style={{
        position: "relative", display: "inline-block",
        color, background: bg, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
        cursor: info ? "help" : "default",
        textDecoration: info ? "underline dotted rgba(0,0,0,0.22)" : "none",
        textUnderlineOffset: 3,
      }}
    >
      {tokenContent}
      {showInline && (
        <span style={{ fontSize: "0.72em", opacity: 0.78, marginLeft: 5, fontWeight: 600, letterSpacing: "0.02em" }}>
          · {info.short}
        </span>
      )}
      {open && info && pos && typeof document !== "undefined" && createPortal(
        <span role="tooltip" style={{
          position: "fixed",
          top: pos.placement === "below" ? pos.top : undefined,
          bottom: pos.placement === "above" ? (window.innerHeight - pos.top) : undefined,
          left: pos.left, transform: "translateX(-50%)",
          background: "#FFFFFF", border: `2px solid ${color}`,
          borderRadius: 12, padding: "14px 18px",
          minWidth: 260, maxWidth: 360,
          boxShadow: `0 0 0 1px ${color}33, 0 24px 48px -12px rgba(0,0,0,0.55), 0 8px 16px -4px rgba(0,0,0,0.30)`,
          zIndex: 9999, whiteSpace: "normal", textAlign: "left",
          color: "#0F0F0F", fontWeight: 400,
          pointerEvents: "none",
        }}>
          <span style={{
            position: "absolute",
            top: pos.placement === "below" ? -8 : undefined,
            bottom: pos.placement === "above" ? -8 : undefined,
            left: "50%",
            transform: pos.placement === "below" ? "translateX(-50%) rotate(45deg)" : "translateX(-50%) rotate(225deg)",
            width: 12, height: 12,
            background: "#FFFFFF",
            borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}`, display: "block"
          }} />
          <span style={{ display: "block", fontWeight: 800, fontSize: 14, color, marginBottom: 6, letterSpacing: "0.01em" }}>
            {token}{info.read ? ` · ${info.read}` : ""} <span style={{ color: "#3F3F3F", fontWeight: 700 }}>· {info.short}</span>
          </span>
          <span style={{ display: "block", fontSize: 13, color: "#1F1F1F", lineHeight: 1.55, marginBottom: info.example ? 8 : 0, fontFamily: "var(--font-latin)", fontWeight: 500 }}>
            {info.desc}
          </span>
          {info.example && (
            <span className="jp" style={{ display: "block", fontSize: 13.5, color: "#0F0F0F", lineHeight: 1.5, paddingTop: 6, borderTop: "1px dashed rgba(0,0,0,0.10)", fontWeight: 600 }}>
              <span style={{ ...KICKER, fontSize: 10, marginRight: 8, color: "#7A7468", fontWeight: 700 }}>例</span>{info.example}
            </span>
          )}
        </span>,
        document.body
      )}
    </span>
  );
}

function ColoredConn({ conn, beginner }) {
  if (!conn) return null;
  const tokens = [];
  let remaining = conn;
  let key = 0;
  while (remaining.length > 0) {
    let earliest = null, earliestIdx = remaining.length, matchedRule = null;
    for (const rule of CONN_COLORS) {
      rule.pattern.lastIndex = 0;
      const m = rule.pattern.exec(remaining);
      if (m && m.index < earliestIdx) { earliest = m; earliestIdx = m.index; matchedRule = rule; }
    }
    if (!earliest) { tokens.push(<span key={key++} style={{ color: C.inkDim }}>{remaining}</span>); break; }
    if (earliestIdx > 0) tokens.push(<span key={key++} style={{ color: C.inkDim }}>{remaining.slice(0, earliestIdx)}</span>);
    tokens.push(
      <ConnToken key={key++} token={earliest[0]} color={matchedRule.color} bg={matchedRule.bg} beginner={beginner} />
    );
    remaining = remaining.slice(earliestIdx + earliest[0].length);
  }
  return <>{tokens}</>;
}

// ─────────── PRIMITIVES ───────────
function Card({ children, style, className, elevated, flush }) {
  return (
    <div className={className} style={{ background: elevated ? C.elevated : C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: flush ? 0 : 18, boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 8px 28px -10px rgba(80,60,30,0.10)", ...style }}>
      {children}
    </div>
  );
}

function Chip({ children, tone = "default", style }) {
  const tones = {
    default: { bg: C.mutedBg, color: C.inkDim, border: C.border },
    accent:  { bg: C.accentSoft, color: C.accent, border: C.accentLine },
    pass:    { bg: C.passSoft, color: C.pass, border: C.passLine },
    muted:   { bg: "transparent", color: C.muted, border: C.border },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", ...style }}>
      {children}
    </span>
  );
}

function KickerLabel({ children, style }) {
  return <div style={{ ...KICKER, ...style }}>{children}</div>;
}

// ─────────── AURORA BACKDROP — full-bleed gradient mesh that drifts behind menu ───────────
function AuroraBackdrop() {
  return (
    <>
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob a" />
        <div className="aurora-blob b" />
        <div className="aurora-blob c" />
      </div>
      <div className="aurora-grain" aria-hidden="true" />
    </>
  );
}

// ─────────── JST CLOCK — live Tokyo time with weekday in JP ───────────
function JSTClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find(p => p.type === t)?.value || "";
  const hh = get("hour"), mm = get("minute"), ss = get("second");
  const wdJp = ["日","月","火","水","木","金","土"];
  const tokyoDay = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const wd = wdJp[tokyoDay.getDay()];
  return (
    <span className="jst-clock">
      <span style={{ color: "var(--muted)", fontSize: 10 }}>東京 · {wd}</span>
      <span>{hh}:{mm}<span className="sec">:{ss}</span></span>
      <span style={{ color: "var(--muted)", fontSize: 10 }}>JST</span>
    </span>
  );
}

// ─────────── HERO DISPLAY — massive 道場 kanji + ribbon + JST clock ───────────
function HeroDisplay({ wide }) {
  return (
    <div style={{ textAlign: "center", padding: wide ? "20px 0 12px" : "12px 0 6px", position: "relative" }}>
      <div className="hero-ribbon" style={{ marginBottom: 16, fontSize: wide ? 13 : 12 }}>
        <span className="live-dot" />
        <span style={{ fontSize: wide ? 14 : 13, fontWeight: 600 }}>道場</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <JSTClock />
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div className="hero-kanji" style={{ position: "relative" }}>道場</div>
      </div>
    </div>
  );
}

// ─────────── HERO STATS — 4 clean numbers, no decorative rings ───────────
function HeroStats({ streak, masteredCount, totalItems, accuracyPct, sessions, wide }) {
  const masteredPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
  const cells = [
    { kicker: "Streak",   big: streak,       sub: "days",                            color: "var(--accent-strong)", icon: <IconFlame size={wide ? 16 : 14} /> },
    { kicker: "Mastery",  big: masteredPct,  sub: `${masteredCount} / ${totalItems}`,sub2: "%", color: "var(--accent-strong)" },
    { kicker: "Accuracy", big: accuracyPct,  sub: "all-time",                       sub2: "%", color: "var(--pass)" },
    { kicker: "Sessions", big: sessions,     sub: "tests",                           color: "var(--ink)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: wide ? 0 : 14, marginTop: wide ? 8 : 14 }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          padding: wide ? "10px 16px" : "12px 8px",
          textAlign: "center",
          borderLeft: wide && i > 0 ? "1px solid var(--hairline)" : "none",
        }}>
          <div style={{ ...KICKER, fontSize: 10, color: "var(--muted)", letterSpacing: "0.22em", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {c.icon && <span style={{ color: c.color }}>{c.icon}</span>}
            {c.kicker}
          </div>
          <div className="num counter-tick" style={{ marginTop: 6, fontSize: wide ? 38 : 30, fontWeight: 300, color: c.color, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {c.big}{c.sub2 && <span style={{ fontSize: wide ? 18 : 14, color: "var(--faint)", fontWeight: 400, marginLeft: 2 }}>{c.sub2}</span>}
          </div>
          <div className="num" style={{ marginTop: 4, fontSize: 11, color: "var(--faint)", fontWeight: 500, letterSpacing: "0.04em" }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────── ACTIVITY RINGS — Apple-fitness triple ring (streak / mastery / accuracy) ───────────
function ActivityRings({ streak, masteredPct, accuracyPct, size = 200 }) {
  const [animated, setAnimated] = useState({ streak: 0, mastery: 0, accuracy: 0 });
  useEffect(() => {
    const id = setTimeout(() => setAnimated({
      streak: Math.min(100, (streak / 7) * 100),
      mastery: Math.max(0, Math.min(100, masteredPct)),
      accuracy: Math.max(0, Math.min(100, accuracyPct)),
    }), 120);
    return () => clearTimeout(id);
  }, [streak, masteredPct, accuracyPct]);
  const stroke = 12;
  const cx = size / 2, cy = size / 2;
  const ring = (r, pct, color, glow) => {
    const c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;
    return (
      <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.2,0.8,0.2,1)", filter: glow }} />
      </>
    );
  };
  const r1 = (size - stroke) / 2;
  const r2 = r1 - stroke - 6;
  const r3 = r2 - stroke - 6;
  return (
    <div className="ring-stack" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="ring-streak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#F43A5C" />
          </linearGradient>
          <linearGradient id="ring-mastery" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#D91840" />
          </linearGradient>
          <linearGradient id="ring-accuracy" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        {ring(r1, animated.streak,   "url(#ring-streak)",   "drop-shadow(0 0 8px rgba(244,58,92,0.55))")}
        {ring(r2, animated.mastery,  "url(#ring-mastery)",  "drop-shadow(0 0 8px rgba(124,58,237,0.55))")}
        {ring(r3, animated.accuracy, "url(#ring-accuracy)", "drop-shadow(0 0 8px rgba(52,211,153,0.55))")}
      </svg>
      <div className="label-center">
        <div style={{ fontFamily: FONT_JP_DISPLAY, fontSize: size * 0.18, fontWeight: 800, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>{masteredPct}<span style={{ fontSize: size * 0.08, color: "var(--muted)", marginLeft: 2 }}>%</span></div>
        <div style={{ ...KICKER, fontSize: 9, color: "var(--muted)", marginTop: 4 }}>習得 · MASTERY</div>
      </div>
    </div>
  );
}

// ─────────── ACTIVITY LEGEND — labels + values for the three rings ───────────
function ActivityLegend({ streak, masteredCount, totalItems, accuracyPct, sessions }) {
  const items = [
    { kicker: "Streak",   val: streak,         suffix: "d",            color: "#FB923C", icon: <IconFlame size={14} /> },
    { kicker: "Mastery",  val: masteredCount,  suffix: `/ ${totalItems}`, color: "var(--kanji-tint)", icon: null },
    { kicker: "Accuracy", val: accuracyPct,    suffix: "%",            color: "#34D399", icon: null },
    { kicker: "Sessions", val: sessions,       suffix: "",             color: "var(--ink)", icon: null },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 16 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 12,
          background: "var(--soft-bg)", border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <span style={{ ...KICKER, fontSize: 11, color: "var(--ink-dim)", display: "inline-flex", alignItems: "center", gap: 7, letterSpacing: "0.16em", fontWeight: 600 }}>
            {it.icon && <span style={{ color: it.color }}>{it.icon}</span>}
            {it.kicker}
          </span>
          <span className="num" style={{ display: "inline-flex", alignItems: "baseline", gap: 5, color: it.color, fontWeight: 700 }}>
            <span style={{ fontSize: 24, lineHeight: 1, letterSpacing: "-0.02em" }}>{it.val}</span>
            {it.suffix && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{it.suffix}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────── AGGREGATIONS ───────────
function getDailyStreak(history) {
  if (!history || history.length === 0) return 0;
  const days = new Set(history.map(h => new Date(h.date).toDateString()));
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const start = days.has(today.toDateString()) ? today : days.has(yest.toDateString()) ? yest : null;
  if (!start) return 0;
  let streak = 0;
  let d = new Date(start);
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ─────────── MASTERY RING (animated SVG) ───────────
function MasteryRing({ pct, size = 68, stroke = 5 }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAnimatedPct(Math.max(0, Math.min(100, pct))), 100);
    return () => clearTimeout(id);
  }, [pct]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c - (animatedPct / 100) * c;
  const gradId = `ring-grad-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.accent} />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.8,0.2,1)" }} />
    </svg>
  );
}

// ─────────── HERO STATS BAR (streak / mastery ring / sessions) ───────────
function HeroStatsBar({ streak, masteredCount, totalItems, sessions, avg, wide }) {
  const masteredPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
  const ringSize = wide ? 80 : 72;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: wide ? 22 : 14, padding: "8px 4px 18px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "right", paddingRight: 4 }}>
        <div style={{ ...KICKER, fontSize: 9, color: C.faint, marginBottom: 6 }}>Streak</div>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
          <span className={streak > 0 ? "streak-pulse" : ""} style={{ display: "inline-flex", color: streak > 0 ? "#EA580C" : C.faint, alignSelf: "center" }}><IconFlame size={18} /></span>
          <span className="num counter-tick" style={{ fontSize: wide ? 30 : 26, fontWeight: 300, lineHeight: 1, letterSpacing: "-0.02em", color: streak > 0 ? C.ink : C.faint }}>{streak}</span>
          <span style={{ ...KICKER, fontSize: 9, color: C.faint }}>d</span>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: ringSize, height: ringSize }}>
          <MasteryRing pct={masteredPct} size={ringSize} stroke={5} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            <span className="num counter-tick" style={{ fontSize: wide ? 19 : 17, fontWeight: 500, color: C.ink, letterSpacing: "-0.01em" }}>{masteredPct}<span style={{ fontSize: 10, color: C.faint }}>%</span></span>
            <span style={{ ...KICKER, fontSize: 8, color: C.faint, marginTop: 2 }}>習得</span>
          </div>
        </div>
        <div style={{ ...KICKER, fontSize: 9, color: C.faint, marginTop: 7 }}>
          <span className="num" style={{ color: C.muted, fontWeight: 600, fontSize: 10 }}>{masteredCount}</span>
          <span style={{ margin: "0 4px" }}>/</span>
          <span className="num" style={{ fontSize: 10 }}>{totalItems}</span>
        </div>
      </div>
      <div style={{ paddingLeft: 4 }}>
        <div style={{ ...KICKER, fontSize: 9, color: C.faint, marginBottom: 6 }}>Sessions</div>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span className="num counter-tick" style={{ fontSize: wide ? 30 : 26, fontWeight: 300, lineHeight: 1, letterSpacing: "-0.02em", color: C.ink }}>{sessions}</span>
          {sessions > 0 && <span className="num" style={{ fontSize: 10, color: C.muted, fontWeight: 500, ...KICKER }}>avg {avg}%</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────── TODAY'S DRILL BRIEF (glass-dark, bigger CTA) ───────────
function TodayBrief({ filteredCount, numQuestions, setNumQuestions, timerMin, setTimerMin, timerSec, setTimerSec, onStart, selectedCount, totalCats }) {
  const canStart = filteredCount >= 4;
  const sliderMin = Math.min(10, filteredCount);
  const sliderMax = filteredCount;
  const sliderVal = Math.min(numQuestions, filteredCount);
  const sliderPct = sliderMax > sliderMin ? ((sliderVal - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;
  const fmtTime = `${timerMin}:${timerSec.toString().padStart(2, "0")}`;
  const TXT = { primary: "var(--ink)", secondary: "var(--ink-dim)", muted: "var(--muted)", faint: "var(--faint)" };
  const numStyle = { ...numInputStyle, background: "var(--soft-bg)", border: "1px solid var(--hairline-strong)", color: "var(--ink)" };
  return (
    <div className="glass-strong" style={{ borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "20px 22px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: "1px solid var(--hairline)", background: "linear-gradient(135deg, rgba(188,0,45,0.20) 0%, rgba(124,58,237,0.10) 100%)" }}>
        <div>
          <div style={{ ...KICKER, fontSize: 10, color: "var(--accent)", marginBottom: 6, letterSpacing: "0.22em" }}>稽古 · TODAY'S DRILL</div>
          <div className="jp-display" style={{ fontFamily: FONT_JP_DISPLAY, fontSize: 36, fontWeight: 800, color: TXT.primary, letterSpacing: "0.02em", lineHeight: 1.05 }}>
            復<span style={{ background: "linear-gradient(135deg, #F43A5C, #BC002D)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>習</span>テスト
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: TXT.muted, letterSpacing: "0.04em" }}>Pull-up review · weighted by errors + recency</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
            <span className="num counter-tick" style={{ fontSize: 44, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em", textShadow: "0 4px 18px rgba(244,58,92,0.55)" }}>{sliderVal}</span>
            <span style={{ ...KICKER, fontSize: 10, color: TXT.faint }}>Q</span>
          </div>
          <div className="num" style={{ ...KICKER, fontSize: 10, color: TXT.muted, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 100, border: "1px solid var(--hairline)" }}>
            <IconClock size={11} /> {fmtTime}
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 22px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <span style={{ ...KICKER, fontSize: 10, color: TXT.muted }}>Question Count</span>
          <span className="num" style={{ fontSize: 12, fontWeight: 500, color: TXT.faint }}>
            <span style={{ color: "var(--accent-strong)", fontWeight: 600 }}>{selectedCount}</span><span style={{ margin: "0 5px" }}>/</span>{totalCats} categories
          </span>
        </div>
        <input
          type="range" min={sliderMin} max={sliderMax} value={sliderVal}
          onChange={e => setNumQuestions(Number(e.target.value))}
          aria-label="Number of questions"
          style={{
            width: "100%", cursor: "pointer", height: 4, marginBottom: 2,
            background: `linear-gradient(to right, #F43A5C 0%, #BC002D ${sliderPct}%, rgba(255,255,255,0.12) ${sliderPct}%, rgba(255,255,255,0.12) 100%)`,
          }}
        />
        <div className="num" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: TXT.faint, fontSize: 10 }}>
          <span>{sliderMin}</span>
          <span>{sliderMax}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "12px 14px", background: "rgba(0,0,0,0.25)", borderRadius: 10, border: "1px solid var(--hairline)" }}>
          <span style={{ ...KICKER, fontSize: 10, color: TXT.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconClock size={12} /> Timer
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min={0} max={99} value={timerMin} onChange={e => setTimerMin(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} style={numStyle} className="num" aria-label="Timer minutes" />
            <span className="num" style={{ color: TXT.faint }}>:</span>
            <input type="number" min={0} max={59} value={timerSec.toString().padStart(2, "0")} onChange={e => setTimerSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} style={numStyle} className="num" aria-label="Timer seconds" />
            <span style={{ ...KICKER, fontSize: 9, color: TXT.faint, marginLeft: 4 }}>· Pass <span className="num" style={{ color: TXT.primary }}>{PASS_SCORE}%</span></span>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 16px 18px" }}>
        <button onClick={onStart} disabled={!canStart} className="mega-cta" aria-label="Start test" style={{
          width: "100%", padding: "22px 26px",
          fontSize: 15, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase",
          borderRadius: 14, cursor: canStart ? "pointer" : "not-allowed", fontFamily: FONT_LATIN,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
        }}>
          <span style={{ ...KICKER, fontSize: 9, color: "var(--muted)", letterSpacing: "0.32em" }}>始</span>
          <span style={{ position: "relative", zIndex: 1 }}>Begin Drill</span>
          <span className="start-arrow" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400, position: "relative", zIndex: 1 }}>→</span>
        </button>
        {!canStart && <div style={{ padding: "8px 4px 0", textAlign: "center", color: TXT.muted, fontSize: 11 }}>Select at least 4 items to start</div>}
      </div>
    </div>
  );
}

// ─────────── HISTORY AREA CHART (smooth sparkline replaces bars) ───────────
function HistoryArea({ history, onPointClick }) {
  if (history.length === 0) return null;
  const recent = history.slice(-12);
  const offset = history.length - recent.length;
  const avg = Math.round(history.reduce((s, h) => s + (h.score / h.total) * 100, 0) / history.length);
  const latest = recent[recent.length - 1];
  const latestPct = Math.round((latest.score / latest.total) * 100);
  const prev = recent.length > 1 ? recent[recent.length - 2] : null;
  const delta = prev ? latestPct - Math.round((prev.score / prev.total) * 100) : 0;

  const W = 340, H = 100, PAD_X = 10, PAD_Y = 12;
  const xs = recent.map((_, i) => recent.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (recent.length - 1));
  const ys = recent.map(s => {
    const p = (s.score / s.total) * 100;
    return H - PAD_Y - (p / 100) * (H - 2 * PAD_Y);
  });
  // Smooth path via cubic bezier midpoints
  let smoothPath = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    smoothPath += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const areaPath = recent.length > 0 ? `${smoothPath} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z` : "";
  const passLineY = H - PAD_Y - (PASS_SCORE / 100) * (H - 2 * PAD_Y);

  const passed = latestPct >= PASS_SCORE;
  const deltaColor = delta > 0 ? C.pass : delta < 0 ? C.accent : C.muted;
  const deltaBg = delta > 0 ? C.passSoft : delta < 0 ? C.accentSoft : C.mutedBg;
  const deltaBorder = delta > 0 ? C.passLine : delta < 0 ? C.accentLine : C.border;

  const TXT = { primary: "var(--ink)", secondary: "var(--ink-dim)", muted: "var(--muted)", faint: "var(--faint)" };
  // Per-test list: latest 8 tests, newest at top, with click-to-review-mistakes
  const listItems = recent.slice().reverse().slice(0, 8).map((s) => {
    const idx = history.indexOf(s);
    const pct = Math.round((s.score / s.total) * 100);
    const isPassed = pct >= PASS_SCORE;
    const wrongs = s.wrongList?.length || 0;
    return { s, idx, pct, isPassed, wrongs };
  });
  return (
    <div className="glass" style={{ borderRadius: 18, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        <div>
          <div style={{ ...KICKER, fontSize: 11, color: "#C4B5FD", letterSpacing: "0.22em", fontWeight: 600 }}>履歴 · SCORE HISTORY</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
            <span className="num counter-tick" style={{ fontSize: 44, fontWeight: 300, color: passed ? "#34D399" : "#F43A5C", lineHeight: 1, letterSpacing: "-0.03em", textShadow: passed ? "0 4px 16px rgba(52,211,153,0.4)" : "0 4px 16px rgba(244,58,92,0.4)" }}>
              {latestPct}<span style={{ fontSize: 18, color: TXT.faint, marginLeft: 2, fontWeight: 400 }}>%</span>
            </span>
            {prev && (
              <span className="num" style={{ fontSize: 12, color: delta > 0 ? "#34D399" : delta < 0 ? "#F43A5C" : TXT.muted, fontWeight: 700, padding: "5px 12px", background: delta > 0 ? "rgba(52,211,153,0.18)" : delta < 0 ? "rgba(244,58,92,0.18)" : "rgba(255,255,255,0.08)", border: `1px solid ${delta > 0 ? "rgba(52,211,153,0.40)" : delta < 0 ? "rgba(244,58,92,0.40)" : "rgba(255,255,255,0.14)"}`, borderRadius: 100, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10 }}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "•"}</span>{Math.abs(delta)}
              </span>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: TXT.muted, letterSpacing: "0.04em" }}>Latest test · tap any session below to review wrong answers</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...KICKER, color: TXT.faint, fontSize: 10, letterSpacing: "0.18em" }}>Last {recent.length}</div>
          <div className="num" style={{ fontSize: 14, color: TXT.secondary, marginTop: 5, fontWeight: 600 }}>avg {avg}%</div>
        </div>
      </div>
      <div style={{ position: "relative", padding: "10px 0 4px" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 110, display: "block" }}>
          <defs>
            <linearGradient id="area-grad-dark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43A5C" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#7C3AED" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="line-grad-dark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="40%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#F43A5C" />
            </linearGradient>
          </defs>
          <line x1={PAD_X} x2={W - PAD_X} y1={passLineY} y2={passLineY} stroke="rgba(52,211,153,0.4)" strokeWidth="1" strokeDasharray="3 4" />
          <text x={W - PAD_X - 2} y={passLineY - 4} textAnchor="end" fontSize="9" fill="#34D399" fontFamily="JetBrains Mono, monospace" opacity="0.85">{PASS_SCORE}%</text>
          {recent.length > 1 && (
            <>
              <path d={areaPath} fill="url(#area-grad-dark)" style={{ animation: "fadeIn 0.7s ease 0.4s both" }} />
              <path d={smoothPath} stroke="url(#line-grad-dark)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: "drawPath 1.4s cubic-bezier(0.4,0,0.2,1) 0.1s forwards", filter: "drop-shadow(0 0 6px rgba(244,58,92,0.6))", "--len": 800 }} />
            </>
          )}
          {recent.map((s, i) => {
            const pct = Math.round((s.score / s.total) * 100);
            const isPassed = pct >= PASS_SCORE;
            const hasDetail = s.wrongList && s.wrongList.length > 0;
            const isLatest = i === xs.length - 1;
            const dotColor = isPassed ? "#34D399" : "#F43A5C";
            return (
              <g key={i} onClick={() => hasDetail && onPointClick(offset + i)} style={{ cursor: hasDetail ? "pointer" : "default" }}>
                {isLatest && <circle cx={xs[i]} cy={ys[i]} r="9" fill={dotColor} opacity="0.20" style={{ animation: "pulse 2s ease-in-out infinite" }} />}
                <circle cx={xs[i]} cy={ys[i]} r={isLatest ? 5 : 3.2} fill={dotColor} stroke="rgba(255,255,255,0.95)" strokeWidth={isLatest ? 2 : 1.5} style={{ animation: `popIn 0.45s cubic-bezier(0.2,0.8,0.2,1) ${0.55 + i * 0.04}s both`, filter: isLatest ? `drop-shadow(0 0 8px ${dotColor})` : "none" }}>
                  <title>{`${pct}%${hasDetail ? " · click for detail" : ""}`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Per-test list — clickable rows to review mistakes */}
      <div style={{ borderTop: "1px solid var(--hairline)" }}>
        <div style={{ padding: "12px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...KICKER, fontSize: 10, color: TXT.muted, letterSpacing: "0.22em", fontWeight: 600 }}>Recent Sessions</span>
          <span style={{ ...KICKER, fontSize: 10, color: TXT.faint }}>tap to review</span>
        </div>
        {listItems.map(({ s, idx, pct, isPassed, wrongs }, i) => {
          const date = new Date(s.date);
          const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
          const isLatest = i === 0;
          return (
            <button
              key={idx}
              onClick={() => onPointClick(idx)}
              disabled={wrongs === 0}
              className="btn-hover"
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                padding: "12px 22px",
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                background: isLatest ? "linear-gradient(90deg, rgba(244,58,92,0.10), transparent 70%)" : "transparent",
                borderLeft: isLatest ? "2px solid #F43A5C" : "2px solid transparent",
                cursor: wrongs > 0 ? "pointer" : "default", color: "inherit", fontFamily: FONT_LATIN,
                opacity: wrongs > 0 ? 1 : 0.55,
              }}
            >
              <span className="num" style={{ fontSize: 11, color: TXT.faint, fontWeight: 500, minWidth: 16 }}>{(listItems.length - i).toString().padStart(2, "0")}</span>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <span className="num" style={{ fontSize: 22, fontWeight: 600, color: isPassed ? "#34D399" : "#F43A5C", lineHeight: 1, letterSpacing: "-0.02em" }}>{pct}<span style={{ fontSize: 12, color: TXT.faint, fontWeight: 400 }}>%</span></span>
              </span>
              <span style={{ flex: 1, display: "inline-flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontSize: 13, color: TXT.primary, fontWeight: 600 }}>{s.score}<span style={{ color: TXT.faint, fontWeight: 400 }}>/{s.total}</span> <span style={{ ...KICKER, fontSize: 9, color: TXT.faint, marginLeft: 6 }}>{isPassed ? "合格" : "不合格"}</span></span>
                <span className="num" style={{ fontSize: 11, color: TXT.muted, marginTop: 3 }}>{dateStr} · {timeStr}</span>
              </span>
              {wrongs > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", background: "rgba(244,58,92,0.18)", border: "1px solid rgba(244,58,92,0.40)", borderRadius: 100 }}>
                  <span className="num" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>×{wrongs}</span>
                  <IconChevRt size={12} style={{ color: "var(--accent)" }} />
                </span>
              ) : (
                <span style={{ ...KICKER, fontSize: 9, color: "#34D399", padding: "5px 10px", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.30)", borderRadius: 100 }}>Perfect</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getMostMistaken(history) {
  const counts = {};
  history.forEach(s => {
    if (!s.wrongList) return;
    s.wrongList.forEach(w => {
      if (!counts[w.jp]) counts[w.jp] = { ...w, count: 0 };
      counts[w.jp].count++;
      if (w.ex) counts[w.jp].ex = w.ex;
      if (w.exHeb) counts[w.jp].exHeb = w.exHeb;
      if (w.kanjiStory) counts[w.jp].kanjiStory = w.kanjiStory;
    });
  });
  return Object.values(counts).sort((a, b) => b.count - a.count);
}

function Leaderboard({ history, dark = false }) {
  const top = getMostMistaken(history).slice(0, 10);
  if (top.length === 0) return null;
  const maxCount = top[0].count;
  const T = dark
    ? { ink: "#FBF7F1", inkDim: "rgba(255,255,255,0.78)", muted: "rgba(255,255,255,0.55)", faint: "var(--faint)", border: "rgba(255,255,255,0.08)", accent: "#F43A5C", kanjiBg: "rgba(124,58,237,0.18)", kanjiBorder: "rgba(167,139,250,0.40)", kanjiInk: "#E9D5FF", barTrack: "rgba(255,255,255,0.10)" }
    : { ink: C.ink, inkDim: C.inkDim, muted: C.muted, faint: C.faint, border: C.border, accent: C.accent, kanjiBg: "rgba(124,58,237,0.06)", kanjiBorder: "rgba(124,58,237,0.22)", kanjiInk: "#5B21B6", barTrack: C.border };

  // Tier sizing: rank 0 = hero, 1-2 = full, 3-5 = compact, 6+ = tight
  const tierFor = (i) => {
    if (i === 0) return { jp: 28, en: 15, meta: 13, pad: "18px 18px", showAll: true, bar: true,  emphasized: true };
    if (i <= 2)   return { jp: 22, en: 14, meta: 12, pad: "14px 18px", showAll: true, bar: false, emphasized: false };
    if (i <= 5)   return { jp: 17, en: 13, meta: 12, pad: "12px 18px", showAll: false, bar: false, emphasized: false };
    return            { jp: 15, en: 12, meta: 11, pad: "10px 18px", showAll: false, bar: false, emphasized: false };
  };

  const Wrapper = dark
    ? ({ children }) => <div className="glass" style={{ borderRadius: 18, overflow: "hidden" }}>{children}</div>
    : ({ children }) => <Card style={{ padding: 0 }} flush>{children}</Card>;
  return (
    <Wrapper>
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...KICKER, color: dark ? "#A78BFA" : C.muted, letterSpacing: dark ? "0.22em" : "0.14em" }}>{dark ? "弱点 · MOST MISTAKEN" : "Most Mistaken"}</span>
        <span style={{ ...KICKER, color: T.faint }}>{top.length} items</span>
      </div>
      <div className="stagger">
        {top.map((w, i) => {
          const t = tierFor(i);
          const barPct = Math.round((w.count / maxCount) * 100);
          return (
            <div
              key={i}
              style={{
                display: "flex", gap: 12, padding: t.pad,
                borderBottom: i < top.length - 1 ? `1px solid ${T.border}` : "none",
                borderLeft: t.emphasized ? `2px solid ${T.accent}` : "2px solid transparent",
                background: t.emphasized ? `linear-gradient(90deg, ${dark ? "rgba(244,58,92,0.14)" : "rgba(188,0,45,0.06)"}, transparent 70%)` : "transparent",
                position: "relative",
              }}
            >
              <div className="num" style={{ fontSize: t.jp >= 22 ? 14 : 12, color: t.emphasized ? T.accent : T.faint, minWidth: 24, paddingTop: 3, fontWeight: t.emphasized ? 600 : 400 }}>
                {(i + 1).toString().padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                  <span className="jp" style={{ fontSize: t.jp, fontWeight: t.emphasized ? 800 : 700, color: T.ink, letterSpacing: "0.01em", lineHeight: 1.2 }}>{w.jp}</span>
                  <span className="num" style={{ fontSize: t.emphasized ? 14 : 11, color: T.accent, fontWeight: t.emphasized ? 600 : 400, whiteSpace: "nowrap" }}>×{w.count}</span>
                </div>
                <div style={{ fontSize: t.en, color: T.inkDim, marginTop: 3, fontWeight: t.emphasized ? 500 : 400, lineHeight: 1.4 }}>{w.en}</div>
                {t.showAll && w.heb && <HebText style={{ color: T.muted, fontSize: t.meta, marginTop: 3 }}>{w.heb}</HebText>}
                {t.showAll && w.ex && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, lineHeight: 1.55, flexWrap: "wrap" }}>
                    <span style={{ ...JP_LABEL, flexShrink: 0, color: dark ? "rgba(255,255,255,0.45)" : undefined }}>例</span>
                    <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: t.meta + 2, color: T.ink, fontWeight: 600 }}><FuriganaSentence text={w.ex} /></span>
                    <SpeakBtn text={stripFurigana(w.ex)} size={12} />
                  </div>
                )}
                {t.showAll && w.exHeb && <HebText style={{ color: T.muted, fontSize: t.meta - 1, marginTop: 3 }}>{w.exHeb}</HebText>}
                {t.showAll && w.kanjiStory && (
                  <div style={{ marginTop: 8, background: T.kanjiBg, border: `1px solid ${T.kanjiBorder}`, borderLeft: "2px solid #A78BFA", padding: "7px 10px", borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 13, lineHeight: 1.2 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: dark ? "#C4B5FD" : C.kanji, fontSize: 9, marginBottom: 2 }}>{storyLabel(w.jp)}</div>
                      <div style={{ fontSize: t.meta, color: T.kanjiInk, fontWeight: 500, lineHeight: 1.5 }}>{w.kanjiStory}</div>
                    </div>
                  </div>
                )}
                {t.bar && (
                  <div style={{ marginTop: 10, height: 3, background: T.barTrack, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barPct}%`, background: dark ? "linear-gradient(90deg, #F43A5C, #A78BFA)" : `linear-gradient(90deg, ${C.accent}, ${C.accentHi})`, transition: "width 0.5s ease" }} />
                  </div>
                )}
              </div>
              <SpeakBtn text={w.jp} size={t.emphasized ? 16 : 14} />
            </div>
          );
        })}
      </div>
    </Wrapper>
  );
}

function HistoryChart({ history, onBarClick }) {
  if (history.length === 0) return null;
  const recent = history.slice(-12);
  const offset = history.length - recent.length;
  const avg = Math.round(history.reduce((s, h) => s + (h.score / h.total) * 100, 0) / history.length);
  return (
    <Card flush>
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <KickerLabel>Score History</KickerLabel>
        <span style={{ ...KICKER, color: C.faint }}>Last {recent.length} · Avg {avg}%</span>
      </div>
      <div className="stagger" style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 96, padding: "16px 18px 14px" }}>
        {recent.map((s, i) => {
          const pct = Math.round((s.score / s.total) * 100);
          const passed = pct >= PASS_SCORE;
          const hasDetail = s.wrongList && s.wrongList.length > 0;
          return (
            <div key={i} onClick={() => hasDetail && onBarClick(offset + i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", cursor: hasDetail ? "pointer" : "default" }} title={hasDetail ? `${pct}% · click for detail` : `${pct}%`}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 24, height: `${Math.max(pct, 6)}%`, background: passed ? C.pass : C.accent, opacity: hasDetail ? 1 : 0.35, borderRadius: 2, transition: "opacity 0.2s" }} />
              </div>
              <span className="num" style={{ fontSize: 10, marginTop: 6, color: passed ? C.pass : C.accent }}>{pct}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HistoryModal({ session, onClose }) {
  if (!session) return null;
  const pct = Math.round((session.score / session.total) * 100);
  const passed = pct >= PASS_SCORE;
  const d = new Date(session.date);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,20,20,0.45)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.surface }}>
          <div>
            <div className="num" style={{ color: passed ? C.pass : C.accent, fontSize: 34, fontWeight: 300, lineHeight: 1 }}>{pct}%</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 4, ...KICKER }}>{d.toLocaleDateString()} · {session.score}/{session.total}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }} className="btn-hover">
            <IconX size={14} />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          {session.wrongList && session.wrongList.length > 0 ? (
            <>
              <KickerLabel style={{ marginBottom: 12 }}>Review ({session.wrongList.length})</KickerLabel>
              {session.wrongList.map((w, i) => <WrongItem key={i} w={w} isLast={i === session.wrongList.length - 1} />)}
            </>
          ) : (
            <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No wrong-answer data for this session</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WrongItem({ w, isLast, dark = false }) {
  const T = dark
    ? { ink: "var(--ink)", inkDim: "var(--ink-dim)", muted: "var(--muted)", faint: "var(--faint)", border: "var(--hairline)", accent: "var(--accent-strong)", pass: "var(--pass)", passSoft: "rgba(52,211,153,0.15)", passLine: "rgba(52,211,153,0.40)", mutedBg: "var(--soft-bg)", kanjiBg: "rgba(124,58,237,0.18)", kanjiBorder: "rgba(167,139,250,0.45)", kanjiInk: "#E9D5FF", kanjiKicker: "#C4B5FD" }
    : { ink: C.ink, inkDim: C.inkDim, muted: C.muted, faint: C.faint, border: C.border, accent: C.accent, pass: C.pass, passSoft: C.passSoft, passLine: C.passLine, mutedBg: C.mutedBg, kanjiBg: "rgba(124,58,237,0.06)", kanjiBorder: "rgba(124,58,237,0.22)", kanjiInk: "#5B21B6", kanjiKicker: C.kanji };
  if (w._aiQuestion) {
    const correct = w.choices?.[w.correctIdx];
    return (
      <div style={{ padding: "14px 0", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Chip tone="accent">{CATEGORIES[w.cat] || "Quiz"} · {w.type}</Chip>
          {w.source?.jp && <SpeakBtn text={cleanJp(w.source.jp)} size={14} />}
        </div>
        <div style={{ marginTop: 10, fontSize: 15, color: T.inkDim, lineHeight: 1.5, fontWeight: 500 }}>
          <span className="jp">{w.prompt}</span>
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", background: T.passSoft, borderLeft: `2px solid ${T.pass}`, borderRadius: 5 }}>
          <div style={{ ...KICKER, fontSize: 9, color: T.pass, marginBottom: 4 }}>Correct</div>
          <div className="jp" style={{ fontSize: 16, color: T.pass, fontWeight: 700 }}>{correct}</div>
        </div>
        {w.explanation && (
          <div style={{ marginTop: 8, fontSize: 13, color: T.muted, fontStyle: "italic", lineHeight: 1.5 }}>
            {w.explanation}
          </div>
        )}
        {w.source?.jp && (w.source.en || w.source.heb) && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: T.mutedBg, borderRadius: 6, fontSize: 13 }}>
            <div style={{ ...KICKER, fontSize: 9, color: T.faint, marginBottom: 3 }}>From</div>
            <div className="jp" style={{ fontSize: 15, color: T.ink, fontWeight: 700 }}>{w.source.jp}</div>
            {w.source.reading && w.source.reading !== w.source.jp && <div className="jp" style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{w.source.reading}</div>}
            {w.source.en && <div style={{ color: T.inkDim, marginTop: 3 }}>{w.source.en}</div>}
            {w.source.heb && <HebText style={{ color: T.muted, marginTop: 2 }}>{w.source.heb}</HebText>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 0", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Chip tone="accent">{CATEGORIES[w.cat]}{w.num ? ` · #${w.num}` : ""}</Chip>
        <SpeakBtn text={cleanJp(w.jp)} size={14} />
      </div>
      <div className="jp" style={{ color: T.ink, fontWeight: 700, fontSize: 22, marginTop: 8, letterSpacing: "0.02em" }}><Furigana jp={w.jp} reading={w.reading} /></div>
      <div style={{ color: T.inkDim, fontSize: 15, marginTop: 4 }}>{w.en}</div>
      {w.heb && <HebText style={{ color: T.muted, fontSize: 14, marginTop: 3 }}>{w.heb}</HebText>}
      {w.oneLiner && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: dark ? "rgba(244,58,92,0.14)" : "rgba(188,0,45,0.06)", borderLeft: `2px solid ${T.accent}`, borderRadius: 5, fontSize: 13, color: T.inkDim, fontStyle: "italic", lineHeight: 1.5 }}>
          &ldquo;{w.oneLiner}&rdquo;
        </div>
      )}
      {w.conn && <div style={{ fontSize: 13, marginTop: 10, color: T.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><span style={{ ...JP_LABEL, color: dark ? "var(--faint)" : undefined }}>接続</span><span className="jp" style={{ fontSize: 14 }}><ColoredConn conn={w.conn} beginner={isBeginnerCat(w.cat)} /></span></div>}
      {w.n5syn && <div style={{ fontSize: 13, marginTop: 6, color: T.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><span style={{ ...KICKER, fontSize: 10, color: T.faint }}>≈ N5</span><span className="jp" style={{ fontSize: 13, color: T.inkDim, fontWeight: 600 }}>{w.n5syn}</span></div>}
      {w.ex && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...JP_LABEL, flexShrink: 0, color: dark ? "var(--faint)" : undefined }}>例</span>
          <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: 16, color: T.ink, fontWeight: 600, lineHeight: 1.55 }}><FuriganaSentence text={w.ex} /></span>
          <SpeakBtn text={stripFurigana(w.ex)} size={13} />
        </div>
      )}
      {w.exHeb && <HebText style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>{w.exHeb}</HebText>}
      {w.kanjiStory && (
        <div style={{ marginTop: 12, background: T.kanjiBg, border: `1px solid ${T.kanjiBorder}`, borderLeft: "2px solid #A78BFA", padding: "10px 14px", borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, lineHeight: 1.2 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ ...KICKER, color: T.kanjiKicker, fontSize: 10, marginBottom: 2 }}>{storyLabel(w.jp)}</div>
            <div style={{ fontSize: 14, color: T.kanjiInk, fontWeight: 500, lineHeight: 1.55 }}>{w.kanjiStory}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── GLOSSARY ───────────
function GlossaryItem({ item, mistakes, bookmarked, onToggle, onToggleBookmark, expanded, dark = false }) {
  const T = dark
    ? { ink: "#FBF7F1", inkDim: "rgba(255,255,255,0.78)", muted: "rgba(255,255,255,0.55)", faint: "rgba(255,255,255,0.45)", border: "rgba(255,255,255,0.10)", accent: "#FCA5A5", accentBg: "rgba(244,58,92,0.18)", accentBorder: "rgba(244,58,92,0.40)", kanjiBg: "rgba(124,58,237,0.18)", kanjiBorder: "rgba(167,139,250,0.45)", kanjiInk: "#E9D5FF" }
    : { ink: C.ink, inkDim: C.inkDim, muted: C.muted, faint: C.faint, border: C.border, accent: C.accent, accentBg: C.accentSoft, accentBorder: C.accentLine, kanjiBg: "rgba(124,58,237,0.06)", kanjiBorder: "rgba(124,58,237,0.22)", kanjiInk: "#5B21B6" };
  return (
    <div onClick={onToggle} style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 20px", cursor: "pointer" }} className="btn-hover">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="jp" style={{ fontSize: 19, fontWeight: 700, color: T.ink, letterSpacing: "0.02em", lineHeight: 1.3 }}>
            {item.jp}
            {item.num && <span className="num" style={{ fontSize: 12, color: T.faint, marginLeft: 8, fontWeight: 400 }}>#{item.num}</span>}
          </div>
          <div style={{ color: T.inkDim, fontSize: 15, marginTop: 4, lineHeight: 1.4 }}>{item.en}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {mistakes > 0 && (
            <span className="num" style={{ fontSize: 12, color: T.accent, fontWeight: 700, background: T.accentBg, border: `1px solid ${T.accentBorder}`, padding: "3px 9px", borderRadius: 5 }}>×{mistakes}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(item.jp); }}
            aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: bookmarked ? T.accent : T.faint, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}
            className="btn-hover"
          >
            <IconStar size={16} filled={bookmarked} />
          </button>
          <IconChevDn size={14} style={{ color: T.faint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }} onClick={e => e.stopPropagation()}>
          {item.heb && <HebText style={{ color: T.muted, fontSize: 14 }}>{item.heb}</HebText>}
          {item.oneLiner && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: T.accentBg, borderLeft: `2px solid ${T.accent}`, borderRadius: 5, fontSize: 14, color: T.inkDim, fontStyle: "italic", lineHeight: 1.5 }}>
              &ldquo;{item.oneLiner}&rdquo;
            </div>
          )}
          {item.conn && (
            <div style={{ fontSize: 13, marginTop: 10, color: T.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...JP_LABEL, color: dark ? "rgba(255,255,255,0.45)" : undefined }}>接続</span>
              <span className="jp" style={{ fontSize: 14, fontWeight: 600 }}><ColoredConn conn={item.conn} beginner={isBeginnerCat(item.cat)} /></span>
            </div>
          )}
          {item.n5syn && (
            <div style={{ fontSize: 13, marginTop: 6, color: T.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...KICKER, fontSize: 10, color: T.faint }}>≈ N5</span>
              <span className="jp" style={{ fontSize: 13, color: T.inkDim, fontWeight: 600 }}>{item.n5syn}</span>
            </div>
          )}
          {item.ex && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", lineHeight: 1.6 }}>
              <span style={{ ...JP_LABEL, flexShrink: 0, color: dark ? "rgba(255,255,255,0.45)" : undefined }}>例</span>
              <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: 16, color: T.ink, fontWeight: 600 }}><FuriganaSentence text={item.ex} /></span>
              <SpeakBtn text={stripFurigana(item.ex)} size={13} />
            </div>
          )}
          {item.exHeb && <HebText style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{item.exHeb}</HebText>}
          {item.kanjiStory && (
            <div style={{ marginTop: 12, background: T.kanjiBg, border: `1px solid ${T.kanjiBorder}`, borderLeft: "3px solid #A78BFA", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, lineHeight: 1.1 }}>🧠</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...KICKER, color: dark ? "#C4B5FD" : C.kanji, marginBottom: 2, fontSize: 10 }}>{storyLabel(item.jp)}</div>
                <div style={{ fontSize: 14, color: T.kanjiInk, fontWeight: 500, lineHeight: 1.55 }}>{item.kanjiStory}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <span style={{ ...KICKER, fontSize: 9, color: T.faint }}>Listen</span>
            <SpeakBtn text={item.jp} size={14} />
          </div>
        </div>
      )}
    </div>
  );
}

function Glossary({ srs, bookmarks, onToggleBookmark, onBack }) {
  const [search, setSearch] = useState("");
  const [openCats, setOpenCats] = useState(() => new Set());
  const [openItems, setOpenItems] = useState(() => new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const ORDERED_CATS = CATEGORY_GROUPS.flatMap(g => g.cats);

  const stats = ALL_DATA.reduce((acc, item) => {
    acc.total++;
    const s = srs[item.jp];
    if (s) {
      if (s.wrong > 0) acc.mistaken++;
      else if (s.right > 0) acc.mastered++;
    }
    return acc;
  }, { total: 0, mistaken: 0, mastered: 0 });

  const matchesSearch = (item) => {
    if (bookmarkedOnly && !bookmarks.has(item.jp)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.jp || "").toLowerCase().includes(q)
      || (item.reading || "").toLowerCase().includes(q)
      || (item.en || "").toLowerCase().includes(q)
      || (item.heb || "").includes(search)
      || (item.kanjiStory || "").toLowerCase().includes(q)
      || (item.oneLiner || "").toLowerCase().includes(q)
      || (item.ex || "").toLowerCase().includes(q);
  };

  const toggleCat = (cat) => setOpenCats(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });
  const toggleItem = (jp) => setOpenItems(prev => {
    const next = new Set(prev);
    if (next.has(jp)) next.delete(jp); else next.add(jp);
    return next;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} className="btn-hover" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IconArrowL size={12} /> Menu
        </button>
        <div style={{ ...KICKER, color: C.muted }}>索引 · Index</div>
        <div style={{ width: 70 }} />
      </div>

      <input
        type="text"
        placeholder="Search · 検索 · חיפוש"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "12px 16px", fontSize: 15,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          outline: "none", color: C.ink, fontFamily: FONT_LATIN, marginBottom: 14,
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ background: C.surface, padding: "12px 8px", textAlign: "center" }}>
          <div className="num" style={{ fontSize: 20, fontWeight: 300, color: C.ink }}>{stats.total}</div>
          <div style={{ ...KICKER, fontSize: 9, marginTop: 4 }}>Total</div>
        </div>
        <div style={{ background: C.surface, padding: "12px 8px", textAlign: "center" }}>
          <div className="num" style={{ fontSize: 20, fontWeight: 300, color: C.accent }}>{bookmarks.size}</div>
          <div style={{ ...KICKER, fontSize: 9, marginTop: 4 }}>★ Saved</div>
        </div>
        <div style={{ background: C.surface, padding: "12px 8px", textAlign: "center" }}>
          <div className="num" style={{ fontSize: 20, fontWeight: 300, color: C.pass }}>{stats.mastered}</div>
          <div style={{ ...KICKER, fontSize: 9, marginTop: 4 }}>Mastered</div>
        </div>
        <div style={{ background: C.surface, padding: "12px 8px", textAlign: "center" }}>
          <div className="num" style={{ fontSize: 20, fontWeight: 300, color: C.accent }}>{stats.mistaken}</div>
          <div style={{ ...KICKER, fontSize: 9, marginTop: 4 }}>Mistaken</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setBookmarkedOnly(false)} className="btn-hover" style={{
          flex: 1, padding: "8px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
          background: !bookmarkedOnly ? C.accentSoft : "transparent",
          color: !bookmarkedOnly ? C.accent : C.muted,
          border: `1px solid ${!bookmarkedOnly ? C.accentLine : C.border}`,
          borderRadius: 8, cursor: "pointer", fontFamily: FONT_LATIN,
        }}>All</button>
        <button onClick={() => setBookmarkedOnly(true)} className="btn-hover" style={{
          flex: 1, padding: "8px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
          background: bookmarkedOnly ? C.accentSoft : "transparent",
          color: bookmarkedOnly ? C.accent : C.muted,
          border: `1px solid ${bookmarkedOnly ? C.accentLine : C.border}`,
          borderRadius: 8, cursor: "pointer", fontFamily: FONT_LATIN,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><IconStar size={12} filled={bookmarkedOnly} /> Bookmarked</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ORDERED_CATS.map(cat => {
          const items = ALL_DATA.filter(d => d.cat === cat);
          const filtered = items.filter(matchesSearch);
          if (filtered.length === 0) return null;
          const catExpanded = !!search || openCats.has(cat);
          const totalMistakes = items.reduce((s, i) => s + (srs[i.jp]?.wrong || 0), 0);
          return (
            <Card key={cat} flush>
              <button onClick={() => toggleCat(cat)} className="btn-hover" style={{
                width: "100%", padding: "14px 18px",
                background: "transparent", border: "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", textAlign: "left",
                fontFamily: FONT_LATIN,
              }}>
                <span className="jp" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>
                  {CATEGORIES[cat]}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {totalMistakes > 0 && (
                    <span className="num" style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>×{totalMistakes}</span>
                  )}
                  <span className="num" style={{ fontSize: 12, color: C.faint }}>
                    {filtered.length}{filtered.length !== items.length ? `/${items.length}` : ""}
                  </span>
                  <IconChevDn size={14} style={{ color: C.faint, transform: catExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </span>
              </button>
              {catExpanded && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {filtered.map((item, i) => (
                    <GlossaryItem
                      key={item.jp + "_" + i}
                      item={item}
                      mistakes={srs[item.jp]?.wrong || 0}
                      bookmarked={bookmarks.has(item.jp)}
                      onToggleBookmark={onToggleBookmark}
                      expanded={!!search || openItems.has(item.jp)}
                      onToggle={() => toggleItem(item.jp)}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────── ACCOUNT ───────────
function AuthModal({ session, onClose, onSignedIn }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setInfo("");
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        onSignedIn?.();
      } else {
        await signUp(email.trim(), password);
        setInfo("Check your email to confirm — then sign in.");
        setMode("signin");
      }
    } catch (e) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    try { await signOut(); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,20,20,0.45)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 420, width: "100%", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <IconCloud size={18} style={{ color: C.accent }} />
            <span style={{ ...KICKER, color: C.ink, fontSize: 13 }}>{session ? "Account" : (mode === "signin" ? "Sign In" : "Create Account")}</span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }} className="btn-hover"><IconX size={13} /></button>
        </div>

        {!cloudEnabled ? (
          <div style={{ fontSize: 13, color: C.inkDim, lineHeight: 1.6 }}>
            Cloud sync isn't configured yet. Once <code style={{ background: C.mutedBg, padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_URL</code> and <code style={{ background: C.mutedBg, padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code> are set in Vercel, sign-in will activate here.
          </div>
        ) : session ? (
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Signed in as</div>
            <div className="num" style={{ fontSize: 15, color: C.ink, marginBottom: 16, wordBreak: "break-all" }}>{session.user?.email}</div>
            <div style={{ background: C.passSoft, border: `1px solid ${C.passLine}`, borderRadius: 8, padding: "10px 12px", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <IconCloud size={14} style={{ color: C.pass }} />
              <span style={{ color: C.pass, fontSize: 12, fontWeight: 600 }}>Auto-syncing across devices</span>
            </div>
            <button onClick={doSignOut} disabled={busy} className="btn-hover" style={{ width: "100%", padding: "12px 16px", fontSize: 12, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", background: "transparent", color: C.inkDim, border: `1px solid ${C.border}`, borderRadius: 10, cursor: busy ? "wait" : "pointer", fontFamily: FONT_LATIN, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <IconLogOut size={13} /> Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ ...KICKER, color: C.muted, display: "block", marginBottom: 6, fontSize: 10 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus style={{ width: "100%", padding: "10px 14px", fontSize: 15, background: C.mutedBg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.ink, fontFamily: FONT_LATIN, marginBottom: 12 }} />
            <label style={{ ...KICKER, color: C.muted, display: "block", marginBottom: 6, fontSize: 10 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ width: "100%", padding: "10px 14px", fontSize: 15, background: C.mutedBg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.ink, fontFamily: FONT_LATIN, marginBottom: 14 }} />
            {err && <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, padding: "8px 12px", background: C.accentSoft, border: `1px solid ${C.accentLine}`, borderRadius: 6 }}>{err}</div>}
            {info && <div style={{ fontSize: 12, color: C.pass, marginBottom: 10, padding: "8px 12px", background: C.passSoft, border: `1px solid ${C.passLine}`, borderRadius: 6 }}>{info}</div>}
            <button type="submit" disabled={busy} className="btn-hover" style={{ width: "100%", padding: "12px 16px", fontSize: 12, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", background: C.accent, color: "#fff", border: `1px solid ${C.accent}`, borderRadius: 10, cursor: busy ? "wait" : "pointer", fontFamily: FONT_LATIN, marginBottom: 10 }}>
              {busy ? "..." : (mode === "signin" ? "Sign In" : "Create Account")}
            </button>
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); setInfo(""); }} style={{ width: "100%", background: "transparent", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: 6, fontFamily: FONT_LATIN }}>
              {mode === "signin" ? "Don't have an account? Create one →" : "Already have an account? Sign in →"}
            </button>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              Your local progress will be merged with the cloud on first sign-in. Nothing is lost.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AccountChip({ session, onClick }) {
  if (!cloudEnabled) {
    return (
      <button onClick={onClick} className="btn-hover" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.faint, fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_LATIN }}>
        <IconCloud size={11} /> Cloud Off
      </button>
    );
  }
  if (!session) {
    return (
      <button onClick={onClick} className="btn-hover" style={{ background: C.accentSoft, border: `1px solid ${C.accentLine}`, color: C.accent, fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_LATIN }}>
        <IconUser size={11} /> Sign In
      </button>
    );
  }
  const email = session.user?.email || "";
  const display = email.length > 20 ? email.slice(0, 17) + "…" : email;
  return (
    <button onClick={onClick} className="btn-hover" style={{ background: C.passSoft, border: `1px solid ${C.passLine}`, color: C.pass, fontSize: 10, fontWeight: 600, padding: "6px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_LATIN, letterSpacing: "0.04em", textTransform: "none" }}>
      <IconCloud size={11} /> {display}
    </button>
  );
}

async function fileToImagePayload(file) {
  // PDFs: send raw bytes as base64
  if (file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { mediaType: "application/pdf", data: btoa(bin), preview: null, name: file.name };
  }
  // iPhone HEIC/HEIF: browsers can't render these natively — convert to JPEG first
  const isHeic = file.type === "image/heic" || file.type === "image/heif"
    || /\.(heic|heif)$/i.test(file.name);
  let workingFile = file;
  let workingName = file.name;
  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
    workingName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    workingFile = new File([jpegBlob], workingName, { type: "image/jpeg" });
  }
  // Images: downscale to 1568px max edge + JPEG 0.85 to keep upload small
  const img = new Image();
  const url = URL.createObjectURL(workingFile);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = 1568;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const base64 = dataUrl.split(",")[1];
  return { mediaType: "image/jpeg", data: base64, preview: dataUrl, name: workingName };
}

const MAX_FILES = 4;

function CustomQuizCreateModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [images, setImages] = useState([]); // [{ mediaType, data, preview, name }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setError("");
    const remaining = MAX_FILES - images.length;
    const incoming = Array.from(fileList).slice(0, remaining);
    if (fileList.length > remaining) {
      setError(`Only ${remaining} more file${remaining === 1 ? "" : "s"} can be added (max ${MAX_FILES} total)`);
    }
    for (const file of incoming) {
      if (file.size > 15 * 1024 * 1024) {
        setError(`"${file.name}" is over 15MB — skipped`);
        continue;
      }
      try {
        const payload = await fileToImagePayload(file);
        setImages(prev => [...prev, payload]);
      } catch (e) {
        setError(`Could not read "${file.name}". Try PNG/JPG/PDF.`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Give the quiz a name"); return; }
    if (!text.trim() && images.length === 0) { setError("Paste vocabulary or attach files"); return; }
    if (text.length > 12000) { setError("Paste is too long (>12000 chars)"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          instructions: instructions.trim() || undefined,
          images: images.length > 0 ? images.map(i => ({ mediaType: i.mediaType, data: i.data })) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
      // New mode: AI returned full questions with prompts + choices
      if (data.mode === "questions") {
        const questions = data.questions || [];
        if (questions.length === 0) { setError("No questions could be generated from this input"); setBusy(false); return; }
        const quiz = { id: `cq_${Date.now()}`, name: name.trim(), createdAt: Date.now(), questions, instructions: instructions.trim() };
        onSaved(quiz);
        return;
      }
      // Default mode: AI returned vocab items, client builds choices at quiz time
      const items = data.items || [];
      if (items.length === 0) { setError("No Japanese terms detected"); setBusy(false); return; }
      const quiz = { id: `cq_${Date.now()}`, name: name.trim(), createdAt: Date.now(), items };
      onSaved(quiz);
    } catch (e) {
      setError(e.message || "Generation failed. Check your Vercel ANTHROPIC_API_KEY.");
      setBusy(false);
    }
  };

  return (
    <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,20,20,0.45)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 12px 40px -10px rgba(80,60,30,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 26px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.surface }}>
          <div style={{ ...KICKER, color: C.ink, fontSize: 15, fontWeight: 700 }}>New Custom Quiz · 自作クイズ</div>
          <button onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: busy ? "not-allowed" : "pointer", width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", opacity: busy ? 0.4 : 1 }} className="btn-hover">
            <IconX size={18} />
          </button>
        </div>
        <div style={{ padding: 26 }}>
          <div style={{ ...KICKER, color: C.muted, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Name</div>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} disabled={busy}
            placeholder="e.g. Job interview vocab"
            style={{ width: "100%", padding: "14px 16px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 18, fontWeight: 500, fontFamily: FONT_LATIN, background: C.surface, color: C.ink, outline: "none", marginBottom: 22 }}
          />
          <div style={{ ...KICKER, color: C.muted, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Paste vocabulary OR describe a topic · 単語 / トピック</div>
          <textarea
            value={text} onChange={e => setText(e.target.value)} disabled={busy}
            placeholder={"Two ways to use this:\n\n— PASTE A LIST: 突然変異 - mutation / 進言 - advice / …\n— DESCRIBE A TOPIC: 'vocabulary for a McDonald's job interview', '20 N1 kanji for tomorrow's test', 'phrases for a hotel check-in', 'JLPT N2 grammar', etc."}
            rows={7}
            style={{ width: "100%", padding: "16px 18px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 17, fontWeight: 500, fontFamily: FONT_JP, background: C.surface, color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.65 }}
          />

          <div style={{ marginTop: 22, ...KICKER, color: C.muted, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Quiz style · 出題スタイル</span>
            <span style={{ ...KICKER, fontSize: 9, color: C.faint, fontWeight: 500 }}>(optional)</span>
          </div>
          <textarea
            value={instructions} onChange={e => setInstructions(e.target.value)} disabled={busy}
            placeholder={"Tell the AI how to design questions. Examples:\n\n— 'Fill-in-the-blank only, focus on N1 grammar'\n— 'Drill keigo: humble vs respectful forms'\n— 'Test reading recognition (kanji → hiragana)'\n— 'Mix particles, conjugations, and meanings'\n— 'Synonym discrimination — pick closest meaning'\n\nLeave blank for a standard meaning + fill-blank mix."}
            rows={5}
            style={{ width: "100%", padding: "14px 16px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontWeight: 500, fontFamily: FONT_LATIN, background: C.surface, color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.55 }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 10px" }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ ...KICKER, fontSize: 11, color: C.faint }}>and / or</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <div style={{ ...KICKER, color: C.muted, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            Attach pages · 画像 / PDF <span style={{ color: C.faint, fontWeight: 500, marginLeft: 6 }}>({images.length}/{MAX_FILES})</span>
          </div>
          <input
            ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple disabled={busy}
            onChange={e => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
          {images.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12, background: C.elevated }}>
                  {img.preview ? (
                    <img src={img.preview} alt={`preview ${idx + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />
                  ) : (
                    <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 20 }}>📄</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{img.name}</div>
                    <div style={{ ...KICKER, fontSize: 10, color: C.faint, marginTop: 3 }}>{img.mediaType}</div>
                  </div>
                  <button onClick={() => removeImage(idx)} disabled={busy} aria-label="Remove" className="btn-hover" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: busy ? "not-allowed" : "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < MAX_FILES && (
            <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="btn-hover" style={{
              width: "100%", padding: images.length === 0 ? "20px" : "14px", border: `2px dashed ${C.border}`, borderRadius: 10,
              background: "transparent", cursor: busy ? "not-allowed" : "pointer", color: C.muted,
              fontSize: 14, fontFamily: FONT_LATIN, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>📎</span>
              <span>{images.length === 0 ? "Choose textbook pages, newspaper, or PDFs…" : `Add another (up to ${MAX_FILES - images.length} more)`}</span>
            </button>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: "12px 16px", background: C.accentSoft, border: `1px solid ${C.accentLine}`, borderRadius: 8, color: C.accent, fontSize: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            {instructions.trim() ? (
              <>AI <strong>designs questions</strong> matching your style — multiple types possible (fill-blank, reading, particle, conjugation, register, synonym, etc.). Uses Sonnet 4.6.</>
            ) : (
              <>AI either <strong>extracts</strong> from your list/image, or <strong>generates</strong> a fresh quiz from your description. Each item gets reading + English + Hebrew + example sentence.</>
            )}
          </div>
          <button
            onClick={submit} disabled={busy} className={busy ? "" : "btn-hover"}
            style={{
              width: "100%", marginTop: 22, padding: "18px 22px",
              fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
              background: busy ? C.mutedBg : C.accent, color: busy ? C.muted : "#fff",
              border: `1px solid ${busy ? C.border : C.accent}`, borderRadius: 12,
              cursor: busy ? "wait" : "pointer", fontFamily: FONT_LATIN,
            }}
          >
            {busy ? "Generating…" : "Generate Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── APP ───────────
export default function App() {
  const wide = useIsWide();
  const PAGE = { position: "relative", minHeight: "100dvh", padding: wide ? "32px 40px 48px" : "18px 18px 40px", maxWidth: wide ? 1180 : 560, margin: "0 auto", color: C.ink, fontFamily: FONT_LATIN };

  const [screen, setScreen] = useState("menu");
  const [selectedCats, setSelectedCats] = useState(Object.keys(CATEGORIES));
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [wrongList, setWrongList] = useState([]);
  const [retryQueue, setRetryQueue] = useState([]);
  const [choices, setChoices] = useState([]);
  const [showNext, setShowNext] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [srs, setSrs] = useState(loadSRS);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const userId = session?.user?.id || null;

  const toggleBookmark = useCallback((jp) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(jp)) next.delete(jp); else next.add(jp);
      saveBookmarks(next);
      return next;
    });
  }, []);
  const [light, setLight] = useState(() => { try { return localStorage.getItem("dojo_theme") === "light"; } catch { return false; } });
  useEffect(() => {
    const html = document.documentElement;
    if (light) html.classList.add("theme-light"); else html.classList.remove("theme-light");
    try { localStorage.setItem("dojo_theme", light ? "light" : "dark"); } catch {}
  }, [light]);
  const [historyModal, setHistoryModal] = useState(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarksExpanded, setBookmarksExpanded] = useState(null);
  const [customQuizzes, setCustomQuizzes] = useState(loadCustomQuizzes);
  const [customOpen, setCustomOpen] = useState(false);
  const [customCreateOpen, setCustomCreateOpen] = useState(false);
  const [quizPool, setQuizPool] = useState(ALL_DATA);

  // Auth + sync wiring (no-ops if cloud not configured)
  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    (async () => {
      const s = await getSession();
      if (!cancelled) setSession(s);
    })();
    const unsub = onAuthChange(async (s) => {
      setSession(s);
      if (s?.user?.id) {
        // On sign-in: pull cloud, merge with local, save merged everywhere
        try {
          const cloud = await fetchCloud(s.user.id);
          const localHistory = loadHistory();
          const localSRS = loadSRS();
          const localBookmarks = [...loadBookmarks()];
          const mergedHistory = mergeHistory(localHistory, cloud?.history || []);
          const mergedSRS = mergeSRS(localSRS, cloud?.srs || {});
          const mergedBookmarks = mergeBookmarks(localBookmarks, cloud?.bookmarks || []);
          // Save merged → local
          localStorage.setItem("nihongo_dojo_history", JSON.stringify(mergedHistory));
          localStorage.setItem("nihongo_dojo_srs", JSON.stringify(mergedSRS));
          localStorage.setItem("nihongo_dojo_bookmarks", JSON.stringify(mergedBookmarks));
          // Reflect in React state
          setHistory(mergedHistory);
          setSrs(mergedSRS);
          setBookmarks(new Set(mergedBookmarks));
          // Push merged → cloud
          scheduleSync(s.user.id, { history: mergedHistory, srs: mergedSRS, bookmarks: mergedBookmarks });
        } catch (e) {
          console.warn("[cloud] initial sync failed:", e?.message || e);
        }
      }
    });
    return () => { cancelled = true; unsub?.(); };
  }, []);

  // Push to cloud whenever any synced data changes (debounced inside cloud.js)
  useEffect(() => {
    if (userId) scheduleSync(userId, { history, srs, bookmarks: [...bookmarks] });
  }, [userId, history, srs, bookmarks]);
  const [numQuestions, setNumQuestions] = useState(QUESTIONS_PER_TEST);
  const [timerMin, setTimerMin] = useState(Math.floor(TIMER_SECONDS / 60));
  const [timerSec, setTimerSec] = useState(TIMER_SECONDS % 60);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setTimerActive(false); setScreen("results"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    if (screen === "results" && !savedRef.current && total > 0) {
      savedRef.current = true;
      const slimWrong = wrongList.map(w => w._aiQuestion
        ? { _aiQuestion: true, jp: w.jp, cat: w.cat, num: w.num, type: w.type, prompt: w.prompt, promptKind: w.promptKind, choices: w.choices, correctIdx: w.correctIdx, explanation: w.explanation, source: w.source }
        : { jp: w.jp, en: w.en, heb: w.heb, cat: w.cat, num: w.num, conn: w.conn, ex: w.ex, exHeb: w.exHeb, kanjiStory: w.kanjiStory, n5syn: w.n5syn, oneLiner: w.oneLiner }
      );
      saveSession({ score, total, bestStreak, cats: selectedCats, wrongList: slimWrong });
      setHistory(loadHistory());
      setSrs(loadSRS());
    }
  }, [screen, total, score, bestStreak, selectedCats, wrongList]);

  const startQuiz = useCallback(() => {
    const filtered = ALL_DATA.filter(d => selectedCats.includes(d.cat));
    if (filtered.length < 4) return;
    const count = Math.min(numQuestions, filtered.length);
    const picked = weightedShuffle(filtered, count).map(q => ({ ...q, _type: pickQuestionType(q) }));
    setQuestions(picked);
    setCurrent(0); setSelected(null); setScore(0); setTotal(0);
    setStreak(0); setBestStreak(0); setWrongList([]); setRetryQueue([]);
    setShowNext(false);
    setTimeLeft(timerMin * 60 + timerSec);
    setTimerActive(true);
    setQuizPool(ALL_DATA);
    setChoices(generateChoices(picked[0], ALL_DATA));
    prefetchRadicalsForJp(picked.map(p => p.jp));
    savedRef.current = false;
    setScreen("quiz");
  }, [selectedCats, numQuestions, timerMin, timerSec]);

  const startCustomQuiz = useCallback((quiz) => {
    // NEW FORMAT: quiz has full AI-designed questions with prompts + choices
    if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      const aiQs = quiz.questions
        .filter(q => Array.isArray(q.choices) && q.choices.length === 4 && typeof q.correctIdx === "number")
        .map((q, i) => ({
          ...q,
          _aiQuestion: true,
          // Mirror SRS-relevant fields onto top level so weightedShuffle keys correctly
          jp: q.source?.jp || `__q_${i}`,
          cat: "CUSTOM",
          num: i + 1,
        }));
      if (aiQs.length < 4) { alert("This quiz needs at least 4 valid questions to run."); return; }
      const count = Math.min(numQuestions, aiQs.length);
      const picked = weightedShuffle(aiQs, count);
      setQuestions(picked);
      setCurrent(0); setSelected(null); setScore(0); setTotal(0);
      setStreak(0); setBestStreak(0); setWrongList([]); setRetryQueue([]);
      setShowNext(false);
      setTimeLeft(timerMin * 60 + timerSec);
      setTimerActive(true);
      setQuizPool([]);
      setChoices([]);
      prefetchRadicalsForJp(picked.map(p => p.source?.jp).filter(Boolean));
      savedRef.current = false;
      setScreen("quiz");
      return;
    }
    // LEGACY FORMAT: items + client-side choice generation
    const items = (quiz.items || []).map((it, i) => ({ ...it, cat: "CUSTOM", num: i + 1 }));
    if (items.length < 4) {
      alert("This quiz needs at least 4 items to run. Add more and regenerate.");
      return;
    }
    const count = Math.min(numQuestions, items.length);
    const picked = weightedShuffle(items, count).map(q => ({ ...q, _type: pickQuestionType(q) }));
    setQuestions(picked);
    setCurrent(0); setSelected(null); setScore(0); setTotal(0);
    setStreak(0); setBestStreak(0); setWrongList([]); setRetryQueue([]);
    setShowNext(false);
    setTimeLeft(timerMin * 60 + timerSec);
    setTimerActive(true);
    setQuizPool(items);
    setChoices(generateChoices(picked[0], items));
    prefetchRadicalsForJp(picked.map(p => p.jp));
    savedRef.current = false;
    setScreen("quiz");
  }, [numQuestions, timerMin, timerSec]);

  const toggleCat = (cat) => setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const handleChoice = (choice) => {
    if (selected) return;
    const q = questions[current];
    // For AI questions, `choice` is the index 0-3 → wrap so `selected` stays truthy when idx===0
    setSelected(q._aiQuestion ? { idx: choice } : choice);
    setTotal(t => t + 1);
    const correct = q._aiQuestion ? (choice === q.correctIdx) : (choice.jp === q.jp);
    playSound(correct);
    updateSRS(q.jp, correct);
    if (correct) {
      setScore(s => s + 1);
      setStreak(s => { const ns = s + 1; setBestStreak(b => Math.max(b, ns)); return ns; });
    } else {
      setStreak(0);
      setWrongList(w => [...w, q]);
      setRetryQueue(r => [...r, q]);
    }
    setTimeout(() => setShowNext(true), 450);
    // Speak relevant audio after answer: AI question speaks source.jp; item speaks ex
    if (q._aiQuestion) {
      const speakText = q.source?.jp || q.prompt;
      if (speakText) setTimeout(() => speak(stripFurigana(speakText)), 850);
    } else if (q.ex) {
      setTimeout(() => speak(stripFurigana(q.ex)), 850);
    }
  };

  const next = () => {
    let nextIdx = current + 1;
    if (nextIdx < questions.length) {
      const nextQ = questions[nextIdx];
      setCurrent(nextIdx); setSelected(null); setShowNext(false);
      if (!nextQ._aiQuestion) setChoices(generateChoices(nextQ, quizPool));
    } else if (retryQueue.length > 0) {
      const retry = retryQueue[0];
      setRetryQueue(r => r.slice(1));
      setQuestions(q => [...q, retry]);
      setCurrent(questions.length);
      setSelected(null); setShowNext(false);
      if (!retry._aiQuestion) setChoices(generateChoices(retry, quizPool));
    } else {
      setTimerActive(false); setScreen("results");
    }
  };

  const kbRef = useRef({});
  const currentQ = questions[current];
  kbRef.current = { selected, showNext, choices, handleChoice, next, q: currentQ };
  useEffect(() => {
    if (screen !== "quiz") return;
    const handler = (e) => {
      // Ignore when typing in an input/textarea
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const s = kbRef.current;
      const isAi = s.q?._aiQuestion;
      const choiceCount = isAi ? (s.q.choices?.length || 0) : s.choices.length;
      if (e.key >= "1" && e.key <= "4" && !s.selected && choiceCount > 0) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < choiceCount) {
          e.preventDefault();
          // AI questions take an index; legacy items take the choice object
          s.handleChoice(isAi ? idx : s.choices[idx]);
        }
      } else if (e.key === "Enter" && s.showNext) {
        e.preventDefault(); s.next();
      } else if (e.key === " " && s.q) {
        e.preventDefault();
        if (isAi) {
          // AI questions: speak the prompt itself (it's the question text)
          speak(stripFurigana(s.q.prompt || s.q.source?.jp || ""));
        } else if (s.q._type === "fillBlank" && !s.selected && s.q.ex) {
          // Fill-blank unanswered: read sentence with the answer hidden (・・・)
          const cleanEx = stripFurigana(s.q.ex);
          const core = findCoreInEx(cleanEx, extractCores(s.q.jp));
          speak(core ? cleanEx.replace(core, "・・・") : cleanEx);
        } else {
          speak(cleanJp(s.q.jp));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  const q = questions[current];
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;
  const filteredCount = ALL_DATA.filter(d => selectedCats.includes(d.cat)).length;

  // ═════════ GLOSSARY ═════════
  if (screen === "glossary") {
    return (
      <div style={PAGE}>
        <Glossary srs={srs} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} onBack={() => setScreen("menu")} />
      </div>
    );
  }

  // ═════════ MENU ═════════
  if (screen === "menu") {
    const totalItems = ALL_DATA.length;
    const avg = history.length > 0 ? Math.round(history.reduce((s, h) => s + (h.score / h.total) * 100, 0) / history.length) : 0;
    const masteredCount = ALL_DATA.filter(i => srs[i.jp]?.right > 0 && (srs[i.jp]?.wrong || 0) === 0).length;
    const mistakenCount = ALL_DATA.filter(i => (srs[i.jp]?.wrong || 0) > 0).length;
    const indexCard = (
      <button onClick={() => setScreen("glossary")} className="glass btn-hover" style={{
        width: "100%", padding: 0, borderRadius: 16,
        cursor: "pointer", textAlign: "left", display: "block", fontFamily: FONT_LATIN, overflow: "hidden",
        marginTop: wide ? 12 : 12,
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <IconBook size={16} style={{ color: "var(--kanji-tint)" }} />
            <span style={{ ...KICKER, color: "var(--ink)", fontSize: 12, letterSpacing: "0.22em" }}>索引 · INDEX</span>
          </span>
          <IconChevRt size={14} style={{ color: "var(--faint)" }} />
        </div>
        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 300, color: "var(--ink)", lineHeight: 1 }}>{totalItems}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: "var(--faint)" }}>Terms</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 300, color: "#FB923C", lineHeight: 1, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconStar size={14} filled style={{ verticalAlign: "middle" }} />{bookmarks.size}
            </div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: "var(--faint)" }}>Saved</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 300, color: "#34D399", lineHeight: 1 }}>{masteredCount}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: "var(--faint)" }}>Mastered</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 300, color: "var(--accent-strong)", lineHeight: 1 }}>{mistakenCount}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: "var(--faint)" }}>Mistaken</div>
          </div>
        </div>
        <div style={{ padding: "10px 18px 14px", color: "var(--muted)", fontSize: 12, borderTop: "1px solid var(--hairline)", background: "rgba(0,0,0,0.18)" }}>
          Browse all terms · kanji stories · examples · bookmarks
        </div>
      </button>
    );
    const dailyStreak = getDailyStreak(history);
    const totalRight = Object.values(srs).reduce((s, x) => s + (x.right || 0), 0);
    const totalWrong = Object.values(srs).reduce((s, x) => s + (x.wrong || 0), 0);
    const accuracyPct = (totalRight + totalWrong) > 0 ? Math.round((totalRight / (totalRight + totalWrong)) * 100) : 0;
    const masteredPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;
    return (
      <div className="aurora-root menu-bottom-pad" style={{ ...PAGE, color: "var(--ink)", overflow: "hidden", minHeight: "100dvh" }}>
        <AuroraBackdrop />
        <div style={{ position: "relative", zIndex: 1 }}>
        {/* HEADER — theme toggle + account chip */}
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 5, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setLight(l => !l)} className="theme-toggle" aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Switch to dark mode" : "Switch to light mode"}>
            <span style={{ fontSize: 14 }}>{light ? "☾" : "☀"}</span>
            <span className="toggle-label">{light ? "Dark" : "Light"}</span>
          </button>
          <AccountChip session={session} onClick={() => setAuthOpen(true)} />
        </div>

        {/* HERO BLOCK — aurora glass with massive 道場 + clean 4-stat strip */}
        <div className="glass-strong" style={{ borderRadius: 24, padding: wide ? "28px 28px 22px" : "20px 18px 18px", marginBottom: wide ? 22 : 18, position: "relative", overflow: "hidden" }}>
          <HeroDisplay wide={wide} />
          <div style={{ marginTop: wide ? 18 : 14, paddingTop: wide ? 18 : 14, borderTop: "1px solid var(--hairline)" }}>
            <HeroStats streak={dailyStreak} masteredCount={masteredCount} totalItems={totalItems} accuracyPct={accuracyPct} sessions={history.length} wide={wide} />
          </div>
        </div>

        {bookmarks.size > 0 && (() => {
          const bookmarkedItems = ALL_DATA.filter(d => bookmarks.has(d.jp));
          return (
            <div style={{ marginBottom: wide ? 14 : 12 }}>
              <button
                onClick={() => setBookmarksOpen(o => !o)}
                className="glass btn-hover"
                style={{
                  width: "100%", borderRadius: 14, padding: "12px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", fontFamily: FONT_LATIN,
                  borderBottomLeftRadius: bookmarksOpen ? 0 : 14,
                  borderBottomRightRadius: bookmarksOpen ? 0 : 14,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <IconStar size={16} filled style={{ color: "var(--accent-strong)" }} />
                  <span style={{ ...KICKER, color: "var(--ink)", fontSize: 12 }}>Bookmarks · 保存</span>
                  <span className="num" style={{ color: "var(--accent-strong)", fontSize: 14, fontWeight: 500, marginLeft: 4 }}>{bookmarks.size}</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {!bookmarksOpen && <span style={{ ...KICKER, color: "var(--faint)", fontSize: 10 }}>Tap to view</span>}
                  <IconChevDn size={14} style={{ color: "var(--muted)", transform: bookmarksOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </span>
              </button>
              {bookmarksOpen && (
                <div className="glass" style={{
                  borderTop: "none",
                  borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
                  maxHeight: 520, overflowY: "auto",
                }}>
                  {bookmarkedItems.map(item => (
                    <GlossaryItem
                      key={item.jp}
                      item={item}
                      mistakes={srs[item.jp]?.wrong || 0}
                      bookmarked={true}
                      onToggle={() => setBookmarksExpanded(p => p === item.jp ? null : item.jp)}
                      onToggleBookmark={toggleBookmark}
                      expanded={bookmarksExpanded === item.jp}
                      dark={!light}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ marginBottom: wide ? 18 : 14 }}>
          <div className="glass" style={{
            borderRadius: 14, padding: "12px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottomLeftRadius: customOpen ? 0 : 14,
            borderBottomRightRadius: customOpen ? 0 : 14,
          }}>
            <button onClick={() => setCustomOpen(o => !o)} className="btn-hover" style={{
              flex: 1, background: "transparent", border: "none", cursor: "pointer",
              padding: 0, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_LATIN, textAlign: "left", color: "inherit",
            }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <span style={{ ...KICKER, color: "var(--ink)", fontSize: 12 }}>My Quizzes · 自作</span>
              <span className="num" style={{ color: "var(--accent-strong)", fontSize: 14, fontWeight: 500, marginLeft: 4 }}>{customQuizzes.length}</span>
              {!customOpen && customQuizzes.length > 0 && <span style={{ ...KICKER, color: "var(--faint)", fontSize: 10, marginLeft: "auto" }}>Tap to view</span>}
              <IconChevDn size={14} style={{ color: "var(--muted)", transform: customOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", marginLeft: customOpen || customQuizzes.length === 0 ? "auto" : 0 }} />
            </button>
            <button onClick={() => setCustomCreateOpen(true)} className="btn-hover" style={{
              marginLeft: 12, padding: "6px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              background: "rgba(244,58,92,0.18)", color: "#F87171", border: "1px solid rgba(244,58,92,0.40)", borderRadius: 8,
              cursor: "pointer", fontFamily: FONT_LATIN, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}>+ New</button>
          </div>
          {customOpen && (
            <div className="glass" style={{
              borderTop: "none",
              borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
              maxHeight: 520, overflowY: "auto",
            }}>
              {customQuizzes.length === 0 ? (
                <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  No custom quizzes yet. Tap <span style={{ color: "var(--accent-strong)", fontWeight: 600 }}>+ New</span> to paste vocab and let AI build one.
                </div>
              ) : customQuizzes.map((quiz, qi) => (
                <div key={quiz.id} style={{ padding: "14px 18px", borderBottom: qi === customQuizzes.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{quiz.name}</div>
                    <div style={{ ...KICKER, fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{quiz.items.length} items · {new Date(quiz.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => startCustomQuiz(quiz)} className="btn-hover" style={{
                    padding: "7px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase",
                    background: "linear-gradient(135deg, #F43A5C, #BC002D)", color: "#fff", border: "1px solid rgba(244,58,92,0.55)", borderRadius: 8,
                    cursor: "pointer", fontFamily: FONT_LATIN,
                  }}>Run</button>
                  <button onClick={() => {
                    if (!confirm(`Delete "${quiz.name}"?`)) return;
                    const next = customQuizzes.filter(q => q.id !== quiz.id);
                    setCustomQuizzes(next); saveCustomQuizzes(next);
                  }} aria-label="Delete quiz" className="btn-hover" style={{
                    background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--faint)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
                  }}>
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" } : {}}>
          {/* LEFT COLUMN: CATEGORIES + (wide) INDEX */}
          <div>
          <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--hairline)" }}>
              <span style={{ ...KICKER, color: "var(--kanji-tint)", letterSpacing: "0.22em" }}>{"\u5206\u91ce \u00b7 CATEGORIES"}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setSelectedCats(Object.keys(CATEGORIES))} className="btn-hover" style={{ background: "rgba(244,58,92,0.18)", color: "#F87171", border: "1px solid rgba(244,58,92,0.40)", borderRadius: 6, padding: "5px 10px", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontFamily: FONT_LATIN }}>All</button>
                <button onClick={() => setSelectedCats([])} className="btn-hover" style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--hairline-strong)", borderRadius: 6, padding: "5px 10px", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", fontFamily: FONT_LATIN }}>None</button>
              </div>
            </div>
            <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CATEGORY_GROUPS.map((group, gi) => {
                const groupCount = group.cats.reduce((s, c) => s + ALL_DATA.filter(d => d.cat === c).length, 0);
                const allOn = group.cats.every(c => selectedCats.includes(c));
                const someOn = group.cats.some(c => selectedCats.includes(c));
                const expanded = expandedGroups.includes(gi);
                const toggleGroup = () => {
                  if (allOn) setSelectedCats(prev => prev.filter(c => !group.cats.includes(c)));
                  else setSelectedCats(prev => [...new Set([...prev, ...group.cats])]);
                };
                const toggleExpand = (e) => { e.stopPropagation(); setExpandedGroups(prev => prev.includes(gi) ? prev.filter(i => i !== gi) : [...prev, gi]); };
                const isSingle = group.cats.length <= 1;
                return (
                  <div key={gi} style={{ gridColumn: expanded ? "1 / -1" : "auto", minWidth: 0 }}>
                    <button onClick={toggleGroup} className={`cat-tile dark-tile${allOn ? " on" : ""}`} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                      padding: "11px 11px 11px 13px", borderRadius: 10, textAlign: "left",
                    }}>
                      <span className="jp" style={{ flex: 1, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit", letterSpacing: "0.02em" }}>
                        {group.label.match(/^[\u3040-\u30ff\u4e00-\u9faf]+/)?.[0] || group.label}
                      </span>
                      <span className="num" style={{ fontSize: 11, color: allOn ? "#FCA5A5" : "var(--faint)" }}>{groupCount}</span>
                      {!isSingle && (
                        <span onClick={toggleExpand} style={{ color: "var(--faint)", display: "inline-flex", padding: "2px 2px", borderRadius: 4 }}>
                          <IconChevDn size={12} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </span>
                      )}
                    </button>
                    {expanded && !isSingle && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 4px 4px" }}>
                        {group.cats.map(key => {
                          const count = ALL_DATA.filter(d => d.cat === key).length;
                          const on = selectedCats.includes(key);
                          return (
                            <button key={key} onClick={() => toggleCat(key)} className="btn-hover" style={{
                              background: on ? "rgba(244,58,92,0.20)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${on ? "rgba(244,58,92,0.45)" : "rgba(255,255,255,0.10)"}`,
                              color: on ? "#FCA5A5" : "var(--ink-dim)",
                              borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontWeight: 500,
                            }}>
                              {CATEGORIES[key]} <span className="num" style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {wide && indexCard}
          </div>

          {/* TODAY'S BRIEF (combined Configure + Start) */}
          <div>
            <TodayBrief
              filteredCount={filteredCount}
              numQuestions={numQuestions}
              setNumQuestions={setNumQuestions}
              timerMin={timerMin}
              setTimerMin={setTimerMin}
              timerSec={timerSec}
              setTimerSec={setTimerSec}
              onStart={startQuiz}
              selectedCount={selectedCats.length}
              totalCats={Object.keys(CATEGORIES).length}
            />
            {!wide && <div style={{ marginTop: 14 }}>{indexCard}</div>}
          </div>
        </div>

        {/* HISTORY + LEADERBOARD */}
        <div style={{ ...(wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" } : {}), marginTop: 18, display: wide ? "grid" : "flex", flexDirection: wide ? undefined : "column", gap: wide ? 18 : 14 }}>
          <HistoryArea history={history} onPointClick={(idx) => setHistoryModal(history[idx])} />
          <Leaderboard history={history} dark={!light} />
        </div>

        {/* STICKY MOBILE CTA — floats above the bottom of the viewport on small screens */}
        <button onClick={startQuiz} disabled={filteredCount < 4} className="sticky-cta-mobile mega-cta" aria-label="Start test (sticky)">
          <span style={{ ...KICKER, fontSize: 9, color: "var(--muted)", letterSpacing: "0.32em" }}>始</span>
          <span>Begin Drill</span>
          <span className="start-arrow" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400 }}>→</span>
        </button>

        {historyModal && <HistoryModal session={historyModal} onClose={() => setHistoryModal(null)} />}
        {authOpen && <AuthModal session={session} onClose={() => setAuthOpen(false)} onSignedIn={() => setAuthOpen(false)} />}
        {customCreateOpen && <CustomQuizCreateModal
          onClose={() => setCustomCreateOpen(false)}
          onSaved={(quiz) => {
            const next = [quiz, ...customQuizzes];
            setCustomQuizzes(next); saveCustomQuizzes(next);
            setCustomCreateOpen(false); setCustomOpen(true);
          }}
        />}
        </div>
      </div>
    );
  }

  // ═════════ RESULTS ═════════
  if (screen === "results") {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= PASS_SCORE;
    const verdictColor = passed ? "var(--pass)" : "var(--accent-strong)";
    const statsData = [
      { label: "Correct",     value: `${score}/${total}` },
      { label: "Best Streak", value: bestStreak },
      { label: "Time",        value: formatTime((timerMin * 60 + timerSec) - timeLeft) },
      { label: "Mistakes",    value: wrongList.length },
    ];
    return (
      <div className="aurora-root" style={{ ...PAGE, color: "var(--ink)", overflow: "hidden", minHeight: "100dvh" }}>
        {!light && <AuroraBackdrop />}
        <div style={{ position: "relative", zIndex: 1 }}>
        {/* VERDICT */}
        <div className="pop-in" style={{ textAlign: "center", marginTop: wide ? 32 : 20, marginBottom: 28 }}>
          <div className="num count-up" style={{ fontSize: wide ? 96 : 72, fontWeight: 300, color: verdictColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {pct}<span style={{ fontSize: "0.5em", color: "var(--muted)", marginLeft: 4 }}>%</span>
          </div>
          <div className="jp-display" style={{ fontSize: wide ? 36 : 28, fontWeight: 600, color: verdictColor, marginTop: 10, letterSpacing: "0.25em" }}>
            {passed ? "合格" : "不合格"}
          </div>
          <div style={{ ...KICKER, color: "var(--muted)", marginTop: 6 }}>
            {passed ? "Passed" : "Retry"}
          </div>
        </div>

        {/* STATS */}
        <div className="slide-up glass" style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
          {statsData.map((s, i) => (
            <div key={s.label} style={{ padding: "16px 14px", textAlign: "center", borderRight: wide && i < 3 ? "1px solid var(--hairline)" : "none", borderBottom: !wide && i < 2 ? "1px solid var(--hairline)" : "none", borderLeft: !wide && i % 2 === 1 ? "1px solid var(--hairline)" : "none" }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 300, color: "var(--ink)", letterSpacing: "-0.01em" }}>{s.value}</div>
              <div style={{ ...KICKER, marginTop: 6, fontSize: 10, color: "var(--muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* REVIEW */}
        {wrongList.length > 0 && (
          <div className="slide-up glass" style={{ borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--hairline)" }}>
              <span style={{ ...KICKER, color: "var(--muted)" }}><span style={{ color: "var(--accent-strong)" }}>Review</span> · {wrongList.length}</span>
            </div>
            <div style={{ padding: "0 18px" }}>
              {wrongList.map((w, i) => <WrongItem key={i} w={w} isLast={i === wrongList.length - 1} dark={!light} />)}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="slide-up" style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => setScreen("menu")} className="btn-hover" style={{ flex: 1, padding: "15px 20px", fontSize: 13, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", background: "transparent", color: "var(--ink-dim)", border: "1px solid var(--hairline-strong)", borderRadius: 10, cursor: "pointer", fontFamily: FONT_LATIN }}>Menu</button>
          <button onClick={startQuiz} className="btn-hover mega-cta" style={{ flex: 2, padding: "15px 20px", fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: 10, cursor: "pointer", fontFamily: FONT_LATIN, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{passed ? "Next Test" : "Retry"} <IconChevRt size={14} /></button>
        </div>
        </div>
      </div>
    );
  }

  // ═════════ QUIZ ═════════
  const timerTotal = timerMin * 60 + timerSec;
  const timerWarn = timerTotal > 0 && timeLeft < Math.min(120, timerTotal * 0.15);
  return (
    <div className="aurora-root" style={{ ...PAGE, color: "var(--ink)", overflow: "hidden", minHeight: "100dvh" }}>
      {!light && <AuroraBackdrop />}
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* TOP BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => { setTimerActive(false); setScreen("results"); }} className="btn-hover" style={{ background: "transparent", border: "1px solid var(--hairline-strong)", color: "var(--muted)", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IconArrowL size={12} /> End
        </button>
        <div className="num" style={{ color: timerWarn ? "var(--accent-strong)" : "var(--ink)", fontSize: 18, fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 8, animation: timerWarn ? "pulse 1s infinite" : "none" }}>
          <IconClock size={14} style={{ color: timerWarn ? "var(--accent-strong)" : "var(--muted)" }} /> {formatTime(timeLeft)}
        </div>
        <div className="num" style={{ color: "var(--ink-dim)", fontSize: 13, fontWeight: 400 }}>
          {(current + 1).toString().padStart(2, "0")} <span style={{ color: "var(--faint)" }}>/</span> {questions.length.toString().padStart(2, "0")}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ height: 2, background: "var(--hairline-strong)", borderRadius: 1, marginBottom: 14, overflow: "hidden" }}>
        <div className="progress-shine" style={{ height: "100%", width: `${progress}%`, background: "var(--accent-strong)", transition: "width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
      </div>

      {/* SCORE LINE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="num" style={{ color: "var(--muted)", fontSize: 12 }}>
          <span style={{ color: "var(--ink)" }}>{score}</span>
          <span style={{ color: "var(--faint)" }}>/{total}</span>
          {total > 0 && <span style={{ marginLeft: 10, color: "var(--faint)" }}>{Math.round((score / total) * 100)}%</span>}
        </div>
        {streak > 2 && (
          <div className="pop-in" key={`streak-${streak}`} style={{ color: "var(--accent-strong)", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span className="flame-flicker" style={{ lineHeight: 1 }}><IconFlame size={13} /></span> <span className="num">{streak}</span>
          </div>
        )}
      </div>

      {q && (() => {
        // ─── AI-DESIGNED QUESTION (new format) ───
        if (q._aiQuestion) {
          const TYPE_LABELS = {
            meaning: "Meaning",
            fillBlank: "Fill in the Blank",
            reading: "Reading · 読み方",
            particle: "Particle",
            conjugation: "Conjugation",
            register: "Keigo · 敬語",
            synonym: "Synonym · 類義",
            general: "Question",
          };
          const promptKind = q.promptKind || "instruction";
          const promptFontSize = promptKind === "kanji"
            ? (wide ? 64 : 50)
            : promptKind === "sentence"
            ? (wide ? 30 : 24)
            : (wide ? 22 : 18);
          const sourceJp = q.source?.jp;
          const bookmarked = sourceJp ? bookmarks.has(sourceJp) : false;
          return (
            <>
              {/* BADGES */}
              <div className="fade-in" key={current + "_badge"} style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <Chip tone="accent">{CATEGORIES[q.cat] || "Quiz"}{q.num ? ` · #${q.num}` : ""}</Chip>
                <Chip tone="default">{TYPE_LABELS[q.type] || q.type}</Chip>
              </div>

              {/* QUESTION CARD */}
              <div className="pop-in" key={current + "_q"} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: wide ? "40px 32px" : "32px 22px", marginBottom: 14, textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`, opacity: 0.5 }} />
                <div className={promptKind === "kanji" ? "jp-display" : "jp"} style={{ fontSize: promptFontSize, fontWeight: promptKind === "kanji" ? 500 : 600, color: C.ink, lineHeight: promptKind === "kanji" ? 1.4 : 1.6, letterSpacing: "0.02em" }}>
                  <FuriganaSentence text={q.prompt} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <SpeakBtn text={stripFurigana(q.prompt)} size={20} />
                </div>
              </div>

              {/* CHOICES */}
              <div className="fade-in" key={current + "_choices"} style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 8 }}>
                {q.choices.map((choice, i) => {
                  const isCorrect = i === q.correctIdx;
                  const isPicked = selected?.idx === i;
                  const isPickedWrong = isPicked && !isCorrect;
                  let bg = C.surface, border = C.border, col = C.ink, accentBar = "transparent", anim = "";
                  if (selected) {
                    if (isPicked && isCorrect) { bg = C.passSoft; border = C.passLine; col = C.pass; accentBar = C.pass; }
                    else if (isPickedWrong) { bg = C.accentSoft; border = C.accentLine; col = C.accent; accentBar = C.accent; anim = "shake 0.4s"; }
                    else if (isCorrect) { bg = C.passSoft; border = C.passLine; col = C.pass; accentBar = C.pass; }
                    else { bg = C.mutedBg; border = C.border; col = C.faint; }
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleChoice(i)}
                      disabled={!!selected}
                      className={selected ? "" : "choice-hover"}
                      style={{
                        background: bg, border: `1px solid ${border}`,
                        borderLeft: `2px solid ${accentBar === "transparent" ? border : accentBar}`,
                        color: col, borderRadius: 12, padding: "16px 18px",
                        textAlign: "left", cursor: selected ? "default" : "pointer",
                        display: "flex", gap: 14, alignItems: "flex-start",
                        fontFamily: FONT_LATIN, animation: anim, transition: "background 0.2s, border 0.2s, color 0.2s",
                      }}
                    >
                      <span className="num" style={{ color: selected ? col : C.accent, fontWeight: 600, fontSize: 22, minWidth: 30, lineHeight: 1, letterSpacing: "-0.01em" }}>
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <div className="jp" style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 600, color: selected ? col : C.ink, lineHeight: 1.4, wordBreak: "break-word" }}>
                        {choice}
                      </div>
                      {selected && isCorrect && <IconCheck size={20} style={{ color: C.pass, marginTop: 2, flexShrink: 0 }} />}
                      {isPickedWrong && <IconX size={20} style={{ color: C.accent, marginTop: 2, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* REVEAL PANEL */}
              {selected && (
                <div className="slide-up" style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
                  <KickerLabel style={{ color: C.pass, marginBottom: 10 }}>Answer</KickerLabel>
                  <div className="jp" style={{ fontSize: 26, fontWeight: 700, color: C.pass, letterSpacing: "0.02em", lineHeight: 1.3 }}>
                    {q.choices[q.correctIdx]}
                  </div>
                  {q.explanation && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: C.accentSoft, borderLeft: `2px solid ${C.accent}`, borderRadius: 6, fontSize: 14, color: C.inkDim, lineHeight: 1.55 }}>
                      {q.explanation}
                    </div>
                  )}
                  {sourceJp && (q.source.en || q.source.heb || q.source.reading) && (
                    <div style={{ marginTop: 16, padding: "12px 14px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <div style={{ ...KICKER, color: C.faint, fontSize: 9, marginBottom: 6 }}>From</div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="jp" style={{ fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>
                            <Furigana jp={sourceJp} reading={q.source.reading} /> <SpeakBtn text={cleanJp(sourceJp)} size={16} />
                          </div>
                          {q.source.en && <div style={{ color: C.inkDim, fontSize: 14, marginTop: 4 }}>{q.source.en}</div>}
                          {q.source.heb && <HebText style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{q.source.heb}</HebText>}
                        </div>
                        <button
                          onClick={() => toggleBookmark(sourceJp)}
                          aria-label={bookmarked ? "Remove bookmark" : "Save to bookmarks"}
                          className="btn-hover"
                          style={{
                            flexShrink: 0,
                            background: bookmarked ? C.accentSoft : "transparent",
                            border: `1px solid ${bookmarked ? C.accentLine : C.border}`,
                            color: bookmarked ? C.accent : C.muted,
                            padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 11, fontWeight: 600,
                          }}
                        >
                          <IconStar size={11} filled={bookmarked} />
                        </button>
                      </div>
                      <KanjiRadicals word={sourceJp} />
                    </div>
                  )}
                </div>
              )}

              {/* NEXT BUTTON */}
              {showNext && (
                <button onClick={next} className="btn-hover slide-up" style={{
                  width: "100%", marginTop: 14, padding: "15px 20px",
                  fontSize: 13, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase",
                  background: C.accent, color: "#fff",
                  border: `1px solid ${C.accent}`, borderRadius: 10, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: FONT_LATIN,
                }} onMouseEnter={e => e.currentTarget.style.background = C.accentHi} onMouseLeave={e => e.currentTarget.style.background = C.accent}>
                  {current + 1 >= questions.length && retryQueue.length === 0 ? "Results" : retryQueue.length > 0 && current + 1 >= questions.length ? `Retry (${retryQueue.length})` : "Next"}
                  <IconChevRt size={13} />
                </button>
              )}

              {wide && (
                <div style={{ textAlign: "center", marginTop: 18, ...KICKER, color: C.faint, fontSize: 10 }}>
                  <kbd>1&ndash;4</kbd> answer · <kbd>Space</kbd> hear · <kbd>Enter</kbd> continue
                </div>
              )}
            </>
          );
        }

        // ─── LEGACY ITEM-BASED QUESTION ───
        const isFill = q._type === "fillBlank";
        const qCore = isFill ? findCoreInEx(q.ex, extractCores(q.jp)) : null;
        const blanked = isFill && qCore ? blankExample(q.ex, qCore) : null;
        return (
          <>
            {/* BADGES */}
            <div className="fade-in" key={current + "_badge"} style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <Chip tone="accent">{CATEGORIES[q.cat]}{q.num ? ` · #${q.num}` : ""}</Chip>
              {isFill && <Chip tone="default">Fill in the Blank</Chip>}
            </div>

            {/* QUESTION CARD */}
            <div className="pop-in" key={current + "_q"} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: wide ? "40px 32px" : "32px 22px", marginBottom: 14, textAlign: "center", position: "relative", overflow: "hidden" }}>
              {/* subtle top red line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`, opacity: 0.5 }} />

              {isFill ? (
                <>
                  <div className="jp-display" style={{ fontSize: wide ? 34 : 26, fontWeight: 500, color: C.ink, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                    <FuriganaSentence text={blanked} /> <SpeakBtn text={stripFurigana(q.ex).replace(qCore, "・・・")} size={20} />
                  </div>
                  <div style={{ ...KICKER, marginTop: 18, color: C.faint }}>Fill the blank</div>
                </>
              ) : (
                <>
                  <div className="jp-display" style={{ fontSize: wide ? 56 : 42, fontWeight: 500, color: C.ink, lineHeight: 1.4, letterSpacing: "0.05em" }}>
                    <Furigana jp={q.jp} reading={q.reading} /> <SpeakBtn text={cleanJp(q.jp)} size={wide ? 26 : 22} />
                  </div>
                  {q.conn && (
                    <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", background: C.mutedBg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                      <span style={JP_LABEL}>接続</span>
                      <span className="jp" style={{ fontSize: 15, fontWeight: 600 }}><ColoredConn conn={q.conn} beginner={isBeginnerCat(q.cat)} /></span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CHOICES */}
            <div className="fade-in" key={current + "_choices"} style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 8 }}>
              {choices.map((c, i) => {
                const isCorrect = c.jp === q.jp;
                const isWrong = selected && c.jp === selected.jp && !isCorrect;
                const isSelCorrect = selected && isCorrect;
                let bg = C.surface, border = C.border, col = C.ink, accentBar = "transparent", anim = "";
                if (selected) {
                  if (isSelCorrect) { bg = C.passSoft; border = C.passLine; col = C.pass; accentBar = C.pass; }
                  else if (isWrong) { bg = C.accentSoft; border = C.accentLine; col = C.accent; accentBar = C.accent; anim = "shake 0.4s"; }
                  else if (isCorrect) { bg = C.passSoft; border = C.passLine; col = C.pass; accentBar = C.pass; }
                  else { bg = C.mutedBg; border = C.border; col = C.faint; }
                }
                const choiceCore = isFill ? (findCoreInEx(c.ex, extractCores(c.jp)) || extractCores(c.jp)[0] || c.jp) : null;
                return (
                  <button
                    key={i}
                    onClick={() => handleChoice(c)}
                    disabled={!!selected}
                    className={selected ? "" : "choice-hover"}
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      borderLeft: `2px solid ${accentBar === "transparent" ? border : accentBar}`,
                      color: col, borderRadius: 12, padding: "18px 20px",
                      textAlign: "left", cursor: selected ? "default" : "pointer",
                      display: "flex", gap: 16, alignItems: "flex-start",
                      fontFamily: FONT_LATIN, animation: anim, transition: "background 0.2s, border 0.2s, color 0.2s",
                    }}
                  >
                    <span className="num" style={{ color: selected ? col : C.accent, fontWeight: 600, fontSize: 22, minWidth: 32, paddingTop: 0, lineHeight: 1, letterSpacing: "-0.01em" }}>
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isFill ? (
                        <>
                          <div className="jp" style={{ fontSize: 22, fontWeight: 700, color: selected ? col : C.ink, lineHeight: 1.3 }}>{choiceCore}</div>
                          {selected && <div style={{ fontSize: 13, marginTop: 5, color: col, opacity: 0.85 }}>{c.en}</div>}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 17, fontWeight: 500, color: selected ? col : C.ink, lineHeight: 1.45 }}>{c.en}</div>
                          {c.heb && <HebText style={{ fontSize: 15, marginTop: 4, color: selected ? col : C.muted, opacity: selected ? 0.85 : 1 }}>{c.heb}</HebText>}
                        </>
                      )}
                    </div>
                    {selected && isCorrect && <IconCheck size={20} style={{ color: C.pass, marginTop: 2 }} />}
                    {selected && isWrong && <IconX size={20} style={{ color: C.accent, marginTop: 2 }} />}
                  </button>
                );
              })}
            </div>

            {/* REVEAL PANEL */}
            {selected && (
              <div className="slide-up" style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
                <KickerLabel style={{ color: C.pass, marginBottom: 12 }}>Answer</KickerLabel>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="jp" style={{ fontSize: 36, fontWeight: 700, color: C.ink, letterSpacing: "0.02em", lineHeight: 1.4 }}><Furigana jp={q.jp} reading={q.reading} /> <SpeakBtn text={cleanJp(q.jp)} size={22} /></div>
                    <div style={{ color: C.inkDim, fontSize: 18, marginTop: 8 }}>{q.en}</div>
                    {q.heb && <HebText style={{ color: C.muted, fontSize: 16, marginTop: 5 }}>{q.heb}</HebText>}
                  </div>
                  <button
                    onClick={() => toggleBookmark(q.jp)}
                    aria-label={bookmarks.has(q.jp) ? "Remove bookmark" : "Save to bookmarks"}
                    className="btn-hover"
                    style={{
                      flexShrink: 0,
                      background: bookmarks.has(q.jp) ? C.accentSoft : "transparent",
                      border: `1px solid ${bookmarks.has(q.jp) ? C.accentLine : C.border}`,
                      color: bookmarks.has(q.jp) ? C.accent : C.muted,
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: FONT_LATIN, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
                    }}
                  >
                    <IconStar size={13} filled={bookmarks.has(q.jp)} />
                    {bookmarks.has(q.jp) ? "Saved" : "Save"}
                  </button>
                </div>

                {q.oneLiner && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: C.accentSoft, borderLeft: `2px solid ${C.accent}`, borderRadius: 6, fontSize: 14, color: C.inkDim, fontStyle: "italic", lineHeight: 1.5 }}>
                    &ldquo;{q.oneLiner}&rdquo;
                  </div>
                )}

                {q.conn && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...JP_LABEL, flexShrink: 0 }}>接続</span>
                    <span className="jp" style={{ fontSize: 15, fontWeight: 600 }}><ColoredConn conn={q.conn} beginner={isBeginnerCat(q.cat)} /></span>
                  </div>
                )}

                {q.n5syn && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...KICKER, fontSize: 10, color: C.faint, flexShrink: 0 }}>≈ N5</span>
                    <span className="jp" style={{ fontSize: 14, color: C.inkDim, fontWeight: 600 }}>{q.n5syn}</span>
                  </div>
                )}

                {q.ex && (
                  <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", lineHeight: 1.6 }}>
                    <span style={{ ...JP_LABEL, flexShrink: 0 }}>例</span>
                    <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: 18, color: C.ink, fontWeight: 600 }}>
                      {isFill && qCore ? q.ex.split(qCore).map((part, idx, arr) => (
                        <span key={idx}><FuriganaSentence text={part} />{idx < arr.length - 1 && <span style={{ background: C.passSoft, color: C.pass, padding: "1px 6px", borderRadius: 3, fontWeight: 700, border: `1px solid ${C.passLine}` }}>{qCore}</span>}</span>
                      )) : <FuriganaSentence text={q.ex} />}
                    </span>
                    <SpeakBtn text={stripFurigana(q.ex)} size={14} />
                  </div>
                )}
                {q.exHeb && <HebText style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{q.exHeb}</HebText>}

                {q.kanjiStory && (
                  <div style={{ marginTop: 16, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "3px solid #7C3AED", borderRadius: 10, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 24, lineHeight: 1.1 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: C.kanji, marginBottom: 6, fontSize: 12, fontWeight: 700 }}>{storyLabel(q.jp)}</div>
                      <div style={{ fontSize: 18, color: "#5B21B6", fontWeight: 500, lineHeight: 1.6 }}>{q.kanjiStory}</div>
                    </div>
                  </div>
                )}
                <KanjiRadicals word={q.jp} />
              </div>
            )}

            {/* NEXT BUTTON */}
            {showNext && (
              <button onClick={next} className="btn-hover slide-up" style={{
                width: "100%", marginTop: 14, padding: "15px 20px",
                fontSize: 13, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase",
                background: C.accent, color: "#fff",
                border: `1px solid ${C.accent}`, borderRadius: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: FONT_LATIN,
              }} onMouseEnter={e => e.currentTarget.style.background = C.accentHi} onMouseLeave={e => e.currentTarget.style.background = C.accent}>
                {current + 1 >= questions.length && retryQueue.length === 0 ? "Results" : retryQueue.length > 0 && current + 1 >= questions.length ? `Retry (${retryQueue.length})` : "Next"}
                <IconChevRt size={13} />
              </button>
            )}

            {wide && (
              <div style={{ textAlign: "center", marginTop: 18, ...KICKER, color: "var(--faint)", fontSize: 10 }}>
                <kbd>1&ndash;4</kbd> answer · <kbd>Space</kbd> hear · <kbd>Enter</kbd> continue
              </div>
            )}
          </>
        );
      })()}
      </div>
    </div>
  );
}

// ─────────── small reusable styles ───────────
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span style={{ ...KICKER }}>{label}</span>
      {children}
    </div>
  );
}

function MiniBtn({ children, onClick, variant }) {
  const ghost = variant === "ghost";
  return (
    <button onClick={onClick} className="btn-hover" style={{
      background: ghost ? "transparent" : C.accentSoft,
      border: `1px solid ${ghost ? C.border : C.accentLine}`,
      color: ghost ? C.muted : C.accent,
      padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
      letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
      fontFamily: FONT_LATIN,
    }}>{children}</button>
  );
}

const numInputStyle = {
  width: 54, textAlign: "center", color: C.ink, fontSize: 14, fontWeight: 400,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 4px",
  outline: "none", background: C.mutedBg,
};

function primaryBtn(wide, flex) {
  return {
    flex, padding: "15px 20px", fontSize: 13, fontWeight: 600,
    letterSpacing: "0.22em", textTransform: "uppercase",
    background: C.accent, color: "#fff",
    border: `1px solid ${C.accent}`, borderRadius: 10, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: FONT_LATIN,
  };
}
function secondaryBtn(wide, flex) {
  return {
    flex, padding: "15px 20px", fontSize: 13, fontWeight: 600,
    letterSpacing: "0.22em", textTransform: "uppercase",
    background: "transparent", color: C.inkDim,
    border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
    fontFamily: FONT_LATIN,
  };
}
