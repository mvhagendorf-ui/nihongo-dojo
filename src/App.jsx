import { useState, useEffect, useCallback, useRef } from "react";
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
function ColoredConn({ conn }) {
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
      <span key={key++} style={{ color: matchedRule.color, background: matchedRule.bg, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
        {earliest[0]}
      </span>
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

// ─────────── AGGREGATIONS ───────────
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

function Leaderboard({ history }) {
  const top = getMostMistaken(history).slice(0, 10);
  if (top.length === 0) return null;
  const maxCount = top[0].count;

  // Tier sizing: rank 0 = hero, 1-2 = full, 3-5 = compact, 6+ = tight
  const tierFor = (i) => {
    if (i === 0) return { jp: 28, en: 15, meta: 13, pad: "18px 18px", showAll: true, bar: true,  emphasized: true };
    if (i <= 2)   return { jp: 22, en: 14, meta: 12, pad: "14px 18px", showAll: true, bar: false, emphasized: false };
    if (i <= 5)   return { jp: 17, en: 13, meta: 12, pad: "12px 18px", showAll: false, bar: false, emphasized: false };
    return            { jp: 15, en: 12, meta: 11, pad: "10px 18px", showAll: false, bar: false, emphasized: false };
  };

  return (
    <Card style={{ padding: 0 }} flush>
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <KickerLabel>Most Mistaken</KickerLabel>
        <span style={{ ...KICKER, color: C.faint }}>{top.length} items</span>
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
                borderBottom: i < top.length - 1 ? `1px solid ${C.border}` : "none",
                borderLeft: t.emphasized ? `2px solid ${C.accent}` : "2px solid transparent",
                background: t.emphasized ? "linear-gradient(90deg, rgba(188,0,45,0.06), transparent 70%)" : "transparent",
                position: "relative",
              }}
            >
              <div className="num" style={{ fontSize: t.jp >= 22 ? 14 : 12, color: t.emphasized ? C.accent : C.faint, minWidth: 24, paddingTop: 3, fontWeight: t.emphasized ? 600 : 400 }}>
                {(i + 1).toString().padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                  <span className="jp" style={{ fontSize: t.jp, fontWeight: t.emphasized ? 800 : 700, color: C.ink, letterSpacing: "0.01em", lineHeight: 1.2 }}>{w.jp}</span>
                  <span className="num" style={{ fontSize: t.emphasized ? 14 : 11, color: C.accent, fontWeight: t.emphasized ? 600 : 400, whiteSpace: "nowrap" }}>×{w.count}</span>
                </div>
                <div style={{ fontSize: t.en, color: C.inkDim, marginTop: 3, fontWeight: t.emphasized ? 500 : 400, lineHeight: 1.4 }}>{w.en}</div>
                {t.showAll && w.heb && <HebText style={{ color: C.muted, fontSize: t.meta, marginTop: 3 }}>{w.heb}</HebText>}
                {t.showAll && w.ex && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, lineHeight: 1.55, flexWrap: "wrap" }}>
                    <span style={{ ...JP_LABEL, flexShrink: 0 }}>例</span>
                    <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: t.meta + 2, color: C.ink, fontWeight: 600 }}>{w.ex}</span>
                    <SpeakBtn text={w.ex} size={12} />
                  </div>
                )}
                {t.showAll && w.exHeb && <HebText style={{ color: C.muted, fontSize: t.meta - 1, marginTop: 3 }}>{w.exHeb}</HebText>}
                {t.showAll && w.kanjiStory && (
                  <div style={{ marginTop: 8, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "2px solid #7C3AED", padding: "7px 10px", borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 13, lineHeight: 1.2 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: C.kanji, fontSize: 9, marginBottom: 2 }}>{storyLabel(w.jp)}</div>
                      <div style={{ fontSize: t.meta, color: "#5B21B6", fontWeight: 500, lineHeight: 1.5 }}>{w.kanjiStory}</div>
                    </div>
                  </div>
                )}
                {t.bar && (
                  <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barPct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accentHi})`, transition: "width 0.5s ease" }} />
                  </div>
                )}
              </div>
              <SpeakBtn text={w.jp} size={t.emphasized ? 16 : 14} />
            </div>
          );
        })}
      </div>
    </Card>
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

function WrongItem({ w, isLast }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: isLast ? "none" : `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Chip tone="accent">{CATEGORIES[w.cat]}{w.num ? ` · #${w.num}` : ""}</Chip>
        <SpeakBtn text={w.jp} size={14} />
      </div>
      <div className="jp" style={{ color: C.ink, fontWeight: 700, fontSize: 22, marginTop: 8, letterSpacing: "0.02em" }}>{w.jp}</div>
      <div style={{ color: C.inkDim, fontSize: 15, marginTop: 4 }}>{w.en}</div>
      {w.heb && <HebText style={{ color: C.muted, fontSize: 14, marginTop: 3 }}>{w.heb}</HebText>}
      {w.oneLiner && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(188,0,45,0.06)", borderLeft: `2px solid ${C.accent}`, borderRadius: 5, fontSize: 13, color: C.inkDim, fontStyle: "italic", lineHeight: 1.5 }}>
          &ldquo;{w.oneLiner}&rdquo;
        </div>
      )}
      {w.conn && <div style={{ fontSize: 13, marginTop: 10, color: C.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><span style={JP_LABEL}>接続</span><span className="jp" style={{ fontSize: 14 }}><ColoredConn conn={w.conn} /></span></div>}
      {w.n5syn && <div style={{ fontSize: 13, marginTop: 6, color: C.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><span style={{ ...KICKER, fontSize: 10, color: C.faint }}>≈ N5</span><span className="jp" style={{ fontSize: 13, color: C.inkDim, fontWeight: 600 }}>{w.n5syn}</span></div>}
      {w.ex && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...JP_LABEL, flexShrink: 0 }}>例</span>
          <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: 16, color: C.ink, fontWeight: 600, lineHeight: 1.55 }}>{w.ex}</span>
          <SpeakBtn text={w.ex} size={13} />
        </div>
      )}
      {w.exHeb && <HebText style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{w.exHeb}</HebText>}
      {w.kanjiStory && (
        <div style={{ marginTop: 12, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "2px solid #7C3AED", padding: "10px 14px", borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, lineHeight: 1.2 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ ...KICKER, color: C.kanji, fontSize: 10, marginBottom: 2 }}>{storyLabel(w.jp)}</div>
            <div style={{ fontSize: 14, color: "#5B21B6", fontWeight: 500, lineHeight: 1.55 }}>{w.kanjiStory}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── GLOSSARY ───────────
function GlossaryItem({ item, mistakes, bookmarked, onToggle, onToggleBookmark, expanded }) {
  return (
    <div onClick={onToggle} style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 18px", cursor: "pointer" }} className="btn-hover">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="jp" style={{ fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>
            {item.jp}
            {item.num && <span className="num" style={{ fontSize: 11, color: C.faint, marginLeft: 8, fontWeight: 400 }}>#{item.num}</span>}
          </div>
          <div style={{ color: C.inkDim, fontSize: 14, marginTop: 2 }}>{item.en}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {mistakes > 0 && (
            <span className="num" style={{ fontSize: 11, color: C.accent, fontWeight: 600, background: C.accentSoft, border: `1px solid ${C.accentLine}`, padding: "2px 8px", borderRadius: 4 }}>×{mistakes}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(item.jp); }}
            aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: bookmarked ? C.accent : C.faint, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}
            className="btn-hover"
          >
            <IconStar size={16} filled={bookmarked} />
          </button>
          <IconChevDn size={14} style={{ color: C.faint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.border}` }} onClick={e => e.stopPropagation()}>
          {item.heb && <HebText style={{ color: C.muted, fontSize: 14 }}>{item.heb}</HebText>}
          {item.oneLiner && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.accentSoft, borderLeft: `2px solid ${C.accent}`, borderRadius: 5, fontSize: 13, color: C.inkDim, fontStyle: "italic", lineHeight: 1.5 }}>
              &ldquo;{item.oneLiner}&rdquo;
            </div>
          )}
          {item.conn && (
            <div style={{ fontSize: 13, marginTop: 10, color: C.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={JP_LABEL}>接続</span>
              <span className="jp" style={{ fontSize: 14, fontWeight: 600 }}><ColoredConn conn={item.conn} /></span>
            </div>
          )}
          {item.n5syn && (
            <div style={{ fontSize: 13, marginTop: 6, color: C.muted, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...KICKER, fontSize: 10, color: C.faint }}>≈ N5</span>
              <span className="jp" style={{ fontSize: 13, color: C.inkDim, fontWeight: 600 }}>{item.n5syn}</span>
            </div>
          )}
          {item.ex && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", lineHeight: 1.6 }}>
              <span style={{ ...JP_LABEL, flexShrink: 0 }}>例</span>
              <span className="jp" style={{ flex: 1, minWidth: 0, fontSize: 16, color: C.ink, fontWeight: 600 }}>{item.ex}</span>
              <SpeakBtn text={item.ex} size={13} />
            </div>
          )}
          {item.exHeb && <HebText style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{item.exHeb}</HebText>}
          {item.kanjiStory && (
            <div style={{ marginTop: 12, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "3px solid #7C3AED", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, lineHeight: 1.1 }}>🧠</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...KICKER, color: C.kanji, marginBottom: 2, fontSize: 10 }}>{storyLabel(item.jp)}</div>
                <div style={{ fontSize: 14, color: "#5B21B6", fontWeight: 500, lineHeight: 1.55 }}>{item.kanjiStory}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <span style={{ ...KICKER, fontSize: 9, color: C.faint }}>Listen</span>
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
          images: images.length > 0 ? images.map(i => ({ mediaType: i.mediaType, data: i.data })) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
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
          <div style={{ ...KICKER, color: C.muted, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Paste vocabulary · 単語リスト</div>
          <textarea
            value={text} onChange={e => setText(e.target.value)} disabled={busy}
            placeholder={"Paste anything — bullet list, mixed languages, headings, the AI sorts it.\n\nExample:\n突然変異 - mutation\n進言（しんげん）- advice\n少子化 declining birth rate"}
            rows={7}
            style={{ width: "100%", padding: "16px 18px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 17, fontWeight: 500, fontFamily: FONT_JP, background: C.surface, color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.65 }}
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
            AI extracts each term, fills in reading + English + Hebrew + example. For images, examples come from the actual sentences on the page. Powered by Claude Haiku.
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
      const slimWrong = wrongList.map(w => ({ jp: w.jp, en: w.en, heb: w.heb, cat: w.cat, num: w.num, conn: w.conn, ex: w.ex, exHeb: w.exHeb, kanjiStory: w.kanjiStory, n5syn: w.n5syn, oneLiner: w.oneLiner }));
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
    savedRef.current = false;
    setScreen("quiz");
  }, [selectedCats, numQuestions, timerMin, timerSec]);

  const startCustomQuiz = useCallback((quiz) => {
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
    savedRef.current = false;
    setScreen("quiz");
  }, [numQuestions, timerMin, timerSec]);

  const toggleCat = (cat) => setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const handleChoice = (choice) => {
    if (selected) return;
    setSelected(choice);
    setTotal(t => t + 1);
    const correct = choice.jp === questions[current].jp;
    playSound(correct);
    updateSRS(questions[current].jp, correct);
    if (correct) {
      setScore(s => s + 1);
      setStreak(s => { const ns = s + 1; setBestStreak(b => Math.max(b, ns)); return ns; });
    } else {
      setStreak(0);
      setWrongList(w => [...w, questions[current]]);
      setRetryQueue(r => [...r, questions[current]]);
    }
    setTimeout(() => setShowNext(true), 450);
    const exText = questions[current].ex;
    if (exText) setTimeout(() => speak(exText), 850);
  };

  const next = () => {
    let nextIdx = current + 1;
    if (nextIdx < questions.length) {
      setCurrent(nextIdx); setSelected(null); setShowNext(false);
      setChoices(generateChoices(questions[nextIdx], quizPool));
    } else if (retryQueue.length > 0) {
      const retry = retryQueue[0];
      setRetryQueue(r => r.slice(1));
      setQuestions(q => [...q, retry]);
      setCurrent(questions.length);
      setSelected(null); setShowNext(false);
      setChoices(generateChoices(retry, quizPool));
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
      if (e.key >= "1" && e.key <= "4" && !s.selected && s.choices.length > 0) {
        const idx = parseInt(e.key, 10) - 1;
        if (s.choices[idx]) { e.preventDefault(); s.handleChoice(s.choices[idx]); }
      } else if (e.key === "Enter" && s.showNext) {
        e.preventDefault(); s.next();
      } else if (e.key === " " && s.q) {
        e.preventDefault();
        // Fill-blank unanswered: read sentence with the answer hidden (・・・)
        // Otherwise: read the JP word/grammar point
        if (s.q._type === "fillBlank" && !s.selected && s.q.ex) {
          const core = findCoreInEx(s.q.ex, extractCores(s.q.jp));
          speak(core ? s.q.ex.replace(core, "・・・") : s.q.ex);
        } else {
          speak(s.q.jp);
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
      <button onClick={() => setScreen("glossary")} className="btn-hover" style={{
        width: "100%", padding: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        cursor: "pointer", textAlign: "left", display: "block", fontFamily: FONT_LATIN, overflow: "hidden",
        marginTop: wide ? 12 : 12,
      }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <IconBook size={16} style={{ color: C.accent }} />
            <span style={{ ...KICKER, color: C.ink, fontSize: 12 }}>Index · 索引</span>
          </span>
          <IconChevRt size={14} style={{ color: C.faint }} />
        </div>
        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 300, color: C.ink, lineHeight: 1 }}>{totalItems}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: C.faint }}>Terms</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 300, color: C.accent, lineHeight: 1, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconStar size={14} filled style={{ verticalAlign: "middle" }} />{bookmarks.size}
            </div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: C.faint }}>Saved</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 300, color: C.pass, lineHeight: 1 }}>{masteredCount}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: C.faint }}>Mastered</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 300, color: C.accent, lineHeight: 1 }}>{mistakenCount}</div>
            <div style={{ ...KICKER, fontSize: 9, marginTop: 5, color: C.faint }}>Mistaken</div>
          </div>
        </div>
        <div style={{ padding: "10px 18px 14px", color: C.muted, fontSize: 12, borderTop: `1px solid ${C.border}`, background: C.elevated }}>
          Browse all terms · kanji stories · examples · bookmarks
        </div>
      </button>
    );
    return (
      <div style={PAGE}>
        {/* HEADER */}
        <div style={{ position: "absolute", top: wide ? 32 : 18, right: wide ? 40 : 18, zIndex: 5 }}>
          <AccountChip session={session} onClick={() => setAuthOpen(true)} />
        </div>
        <header style={{ textAlign: "center", marginBottom: wide ? 32 : 24, paddingTop: 4 }}>
          <div className="logo-wrap logo-wrap--light" role="button" tabIndex={0} aria-label="日本語道場" style={{ width: wide ? 300 : 240, height: wide ? 300 : 240, margin: "0 auto 10px" }}>
            <img className="logo-img" src="/logo.png" alt="日本語道場" style={{ width: "100%", height: "100%", clipPath: "circle(40% at 50% 50%)" }} />
            <svg className="logo-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" /></svg>
          </div>
          <div style={{ ...KICKER, color: C.faint, marginTop: 6 }}>
            N2 / N1 · {totalItems} items{history.length > 0 ? ` · ${history.length} tests · avg ${avg}%` : ""}
          </div>
        </header>

        {bookmarks.size > 0 && (() => {
          const bookmarkedItems = ALL_DATA.filter(d => bookmarks.has(d.jp));
          return (
            <div style={{ marginBottom: wide ? 18 : 14 }}>
              <button
                onClick={() => setBookmarksOpen(o => !o)}
                className="btn-hover"
                style={{
                  width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: "12px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", fontFamily: FONT_LATIN,
                  boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 8px 28px -10px rgba(80,60,30,0.10)",
                  borderBottomLeftRadius: bookmarksOpen ? 0 : 14,
                  borderBottomRightRadius: bookmarksOpen ? 0 : 14,
                  borderBottom: bookmarksOpen ? "none" : `1px solid ${C.border}`,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <IconStar size={16} filled style={{ color: C.accent }} />
                  <span style={{ ...KICKER, color: C.ink, fontSize: 12 }}>Bookmarks · 保存</span>
                  <span className="num" style={{ color: C.accent, fontSize: 14, fontWeight: 500, marginLeft: 4 }}>{bookmarks.size}</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {!bookmarksOpen && <span style={{ ...KICKER, color: C.faint, fontSize: 10 }}>Tap to view</span>}
                  <IconChevDn size={14} style={{ color: C.faint, transform: bookmarksOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </span>
              </button>
              {bookmarksOpen && (
                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderTop: "none",
                  borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
                  maxHeight: 520, overflowY: "auto",
                  boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 8px 28px -10px rgba(80,60,30,0.10)",
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
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ marginBottom: wide ? 18 : 14 }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: "12px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 8px 28px -10px rgba(80,60,30,0.10)",
            borderBottomLeftRadius: customOpen ? 0 : 14,
            borderBottomRightRadius: customOpen ? 0 : 14,
            borderBottom: customOpen ? "none" : `1px solid ${C.border}`,
          }}>
            <button onClick={() => setCustomOpen(o => !o)} className="btn-hover" style={{
              flex: 1, background: "transparent", border: "none", cursor: "pointer",
              padding: 0, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_LATIN, textAlign: "left",
            }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <span style={{ ...KICKER, color: C.ink, fontSize: 12 }}>My Quizzes · 自作</span>
              <span className="num" style={{ color: C.accent, fontSize: 14, fontWeight: 500, marginLeft: 4 }}>{customQuizzes.length}</span>
              {!customOpen && customQuizzes.length > 0 && <span style={{ ...KICKER, color: C.faint, fontSize: 10, marginLeft: "auto" }}>Tap to view</span>}
              <IconChevDn size={14} style={{ color: C.faint, transform: customOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", marginLeft: customOpen || customQuizzes.length === 0 ? "auto" : 0 }} />
            </button>
            <button onClick={() => setCustomCreateOpen(true)} className="btn-hover" style={{
              marginLeft: 12, padding: "6px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              background: C.accentSoft, color: C.accent, border: `1px solid ${C.accentLine}`, borderRadius: 8,
              cursor: "pointer", fontFamily: FONT_LATIN, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}>+ New</button>
          </div>
          {customOpen && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderTop: "none",
              borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
              maxHeight: 520, overflowY: "auto",
              boxShadow: "0 1px 2px rgba(80,60,30,0.04), 0 8px 28px -10px rgba(80,60,30,0.10)",
            }}>
              {customQuizzes.length === 0 ? (
                <div style={{ padding: "24px 18px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No custom quizzes yet. Tap <span style={{ color: C.accent, fontWeight: 600 }}>+ New</span> to paste vocab and let AI build one.
                </div>
              ) : customQuizzes.map((quiz, qi) => (
                <div key={quiz.id} style={{ padding: "14px 18px", borderBottom: qi === customQuizzes.length - 1 ? "none" : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{quiz.name}</div>
                    <div style={{ ...KICKER, fontSize: 10, color: C.faint, marginTop: 3 }}>{quiz.items.length} items · {new Date(quiz.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => startCustomQuiz(quiz)} className="btn-hover" style={{
                    padding: "7px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase",
                    background: C.accent, color: "#fff", border: `1px solid ${C.accent}`, borderRadius: 8,
                    cursor: "pointer", fontFamily: FONT_LATIN,
                  }}>Run</button>
                  <button onClick={() => {
                    if (!confirm(`Delete "${quiz.name}"?`)) return;
                    const next = customQuizzes.filter(q => q.id !== quiz.id);
                    setCustomQuizzes(next); saveCustomQuizzes(next);
                  }} aria-label="Delete quiz" className="btn-hover" style={{
                    background: "transparent", border: "none", padding: 4, cursor: "pointer", color: C.faint,
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
          <Card flush>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
              <KickerLabel>Categories</KickerLabel>
              <div style={{ display: "flex", gap: 6 }}>
                <MiniBtn onClick={() => setSelectedCats(Object.keys(CATEGORIES))}>All</MiniBtn>
                <MiniBtn onClick={() => setSelectedCats([])} variant="ghost">None</MiniBtn>
              </div>
            </div>
            <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
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
                    <button onClick={toggleGroup} className="btn-hover" style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                      padding: "10px 10px", borderRadius: 8, textAlign: "left",
                      background: allOn ? C.accentSoft : someOn ? "rgba(188,0,45,0.04)" : C.mutedBg,
                      border: `1px solid ${allOn ? C.accentLine : someOn ? "rgba(188,0,45,0.15)" : C.border}`,
                      color: allOn ? C.ink : someOn ? C.inkDim : C.inkDim
                    }}>
                      <span className="jp" style={{ flex: 1, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit", letterSpacing: "0.02em" }}>
                        {group.label.match(/^[\u3040-\u30ff\u4e00-\u9faf]+/)?.[0] || group.label}
                      </span>
                      <span className="num" style={{ fontSize: 11, color: allOn ? C.accent : C.faint }}>{groupCount}</span>
                      {!isSingle && (
                        <span onClick={toggleExpand} style={{ color: C.faint, display: "inline-flex", padding: "2px 2px", borderRadius: 4 }}>
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
                              background: on ? C.accentSoft : "transparent",
                              border: `1px solid ${on ? C.accentLine : C.border}`,
                              color: on ? C.accent : C.muted,
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
          </Card>
          {wide && indexCard}
          </div>

          {/* CONFIGURE + START */}
          <div>
            <Card flush>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
                <KickerLabel>Configure</KickerLabel>
              </div>
              <div style={{ padding: "16px 18px" }}>
                <Row label="Questions">
                  <input type="number" min={Math.min(10, filteredCount)} max={filteredCount} value={Math.min(numQuestions, filteredCount)} onChange={e => { const v = Number(e.target.value); if (v >= 1 && v <= filteredCount) setNumQuestions(v); }} style={numInputStyle} className="num" />
                </Row>
                {(() => {
                  const sMin = Math.min(10, filteredCount);
                  const sMax = filteredCount;
                  const sVal = Math.min(numQuestions, filteredCount);
                  const pct = sMax > sMin ? ((sVal - sMin) / (sMax - sMin)) * 100 : 0;
                  return (
                    <input
                      type="range" min={sMin} max={sMax} value={sVal}
                      onChange={e => setNumQuestions(Number(e.target.value))}
                      style={{
                        width: "100%", cursor: "pointer", marginTop: 4, height: 4,
                        background: `linear-gradient(to right, ${C.accent} 0%, ${C.accent} ${pct}%, ${C.border} ${pct}%, ${C.border} 100%)`,
                      }}
                    />
                  );
                })()}
                <div className="num" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: C.faint, fontSize: 10 }}>
                  <span>{Math.min(10, filteredCount)}</span>
                  <span>{filteredCount}</span>
                </div>

                <div style={{ height: 1, background: C.border, margin: "16px 0" }} />

                <Row label="Timer">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" min={0} max={99} value={timerMin} onChange={e => setTimerMin(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} style={numInputStyle} className="num" />
                    <span className="num" style={{ color: C.faint }}>:</span>
                    <input type="number" min={0} max={59} value={timerSec.toString().padStart(2, "0")} onChange={e => setTimerSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} style={numInputStyle} className="num" />
                  </div>
                </Row>

                <div style={{ height: 1, background: C.border, margin: "16px 0" }} />

                <Row label="Pass">
                  <span className="num" style={{ color: C.ink, fontSize: 15 }}>{PASS_SCORE}%</span>
                </Row>
              </div>
            </Card>

            <button onClick={startQuiz} disabled={filteredCount < 4} className={filteredCount >= 4 ? "btn-hover" : ""} style={{
              width: "100%", marginTop: 12, padding: "16px 20px",
              fontSize: 14, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase",
              background: filteredCount >= 4 ? C.accent : C.mutedBg,
              color: filteredCount >= 4 ? "#fff" : C.faint,
              border: `1px solid ${filteredCount >= 4 ? C.accent : C.border}`,
              borderRadius: 10, cursor: filteredCount >= 4 ? "pointer" : "not-allowed",
              fontFamily: FONT_LATIN,
            }} onMouseEnter={e => { if (filteredCount >= 4) e.currentTarget.style.background = C.accentHi; }} onMouseLeave={e => { if (filteredCount >= 4) e.currentTarget.style.background = C.accent; }}>
              Start Test
            </button>
            {!wide && indexCard}
          </div>
        </div>

        {/* HISTORY + LEADERBOARD */}
        <div style={{ ...(wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" } : {}), marginTop: 18, display: wide ? "grid" : "flex", flexDirection: wide ? undefined : "column", gap: wide ? 18 : 14 }}>
          <HistoryChart history={history} onBarClick={(idx) => setHistoryModal(history[idx])} />
          <Leaderboard history={history} />
        </div>

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
    );
  }

  // ═════════ RESULTS ═════════
  if (screen === "results") {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= PASS_SCORE;
    const verdictColor = passed ? C.pass : C.accent;
    const statsData = [
      { label: "Correct",     value: `${score}/${total}` },
      { label: "Best Streak", value: bestStreak },
      { label: "Time",        value: formatTime((timerMin * 60 + timerSec) - timeLeft) },
      { label: "Mistakes",    value: wrongList.length },
    ];
    return (
      <div style={PAGE}>
        {/* VERDICT */}
        <div className="pop-in" style={{ textAlign: "center", marginTop: wide ? 32 : 20, marginBottom: 28 }}>
          <div className="num count-up" style={{ fontSize: wide ? 96 : 72, fontWeight: 300, color: verdictColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {pct}<span style={{ fontSize: "0.5em", color: C.muted, marginLeft: 4 }}>%</span>
          </div>
          <div className="jp-display" style={{ fontSize: wide ? 36 : 28, fontWeight: 600, color: verdictColor, marginTop: 10, letterSpacing: "0.25em" }}>
            {passed ? "合格" : "不合格"}
          </div>
          <div style={{ ...KICKER, color: C.muted, marginTop: 6 }}>
            {passed ? "Passed" : "Retry"}
          </div>
        </div>

        {/* STATS */}
        <div className="slide-up" style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
          {statsData.map(s => (
            <div key={s.label} style={{ background: C.surface, padding: "16px 14px", textAlign: "center" }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 300, color: C.ink, letterSpacing: "-0.01em" }}>{s.value}</div>
              <div style={{ ...KICKER, marginTop: 6, fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* REVIEW */}
        {wrongList.length > 0 && (
          <Card className="slide-up" flush>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
              <KickerLabel><span style={{ color: C.accent }}>Review</span> · {wrongList.length}</KickerLabel>
            </div>
            <div style={{ padding: "0 18px" }}>
              {wrongList.map((w, i) => <WrongItem key={i} w={w} isLast={i === wrongList.length - 1} />)}
            </div>
          </Card>
        )}

        {/* ACTIONS */}
        <div className="slide-up" style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => setScreen("menu")} className="btn-hover" style={secondaryBtn(wide, 1)}>Menu</button>
          <button onClick={startQuiz} className="btn-hover" style={primaryBtn(wide, 2)}>{passed ? "Next Test" : "Retry"} <IconChevRt size={14} /></button>
        </div>
      </div>
    );
  }

  // ═════════ QUIZ ═════════
  const timerTotal = timerMin * 60 + timerSec;
  const timerWarn = timerTotal > 0 && timeLeft < Math.min(120, timerTotal * 0.15);
  return (
    <div style={PAGE}>
      {/* TOP BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => { setTimerActive(false); setScreen("results"); }} className="btn-hover" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IconArrowL size={12} /> End
        </button>
        <div className="num" style={{ color: timerWarn ? C.accent : C.ink, fontSize: 18, fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 8, animation: timerWarn ? "pulse 1s infinite" : "none" }}>
          <IconClock size={14} style={{ color: timerWarn ? C.accent : C.muted }} /> {formatTime(timeLeft)}
        </div>
        <div className="num" style={{ color: C.inkDim, fontSize: 13, fontWeight: 400 }}>
          {(current + 1).toString().padStart(2, "0")} <span style={{ color: C.faint }}>/</span> {questions.length.toString().padStart(2, "0")}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ height: 2, background: C.border, borderRadius: 1, marginBottom: 14, overflow: "hidden" }}>
        <div className="progress-shine" style={{ height: "100%", width: `${progress}%`, background: C.accent, transition: "width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
      </div>

      {/* SCORE LINE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="num" style={{ color: C.muted, fontSize: 12 }}>
          <span style={{ color: C.ink }}>{score}</span>
          <span style={{ color: C.faint }}>/{total}</span>
          {total > 0 && <span style={{ marginLeft: 10, color: C.faint }}>{Math.round((score / total) * 100)}%</span>}
        </div>
        {streak > 2 && (
          <div className="pop-in" key={`streak-${streak}`} style={{ color: C.accent, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span className="flame-flicker" style={{ lineHeight: 1 }}><IconFlame size={13} /></span> <span className="num">{streak}</span>
          </div>
        )}
      </div>

      {q && (() => {
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
                    {blanked} <SpeakBtn text={q.ex.replace(qCore, "・・・")} size={20} />
                  </div>
                  <div style={{ ...KICKER, marginTop: 18, color: C.faint }}>Fill the blank</div>
                </>
              ) : (
                <>
                  <div className="jp-display" style={{ fontSize: wide ? 56 : 42, fontWeight: 500, color: C.ink, lineHeight: 1.4, letterSpacing: "0.05em" }}>
                    {q.jp} <SpeakBtn text={q.jp} size={wide ? 26 : 22} />
                  </div>
                  {q.conn && (
                    <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", background: C.mutedBg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                      <span style={JP_LABEL}>接続</span>
                      <span className="jp" style={{ fontSize: 15, fontWeight: 600 }}><ColoredConn conn={q.conn} /></span>
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
                    <div className="jp" style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>{q.jp} <SpeakBtn text={q.jp} size={16} /></div>
                    <div style={{ color: C.inkDim, fontSize: 16, marginTop: 5 }}>{q.en}</div>
                    {q.heb && <HebText style={{ color: C.muted, fontSize: 15, marginTop: 4 }}>{q.heb}</HebText>}
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
                    <span className="jp" style={{ fontSize: 15, fontWeight: 600 }}><ColoredConn conn={q.conn} /></span>
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
                        <span key={idx}>{part}{idx < arr.length - 1 && <span style={{ background: C.passSoft, color: C.pass, padding: "1px 6px", borderRadius: 3, fontWeight: 700, border: `1px solid ${C.passLine}` }}>{qCore}</span>}</span>
                      )) : q.ex}
                    </span>
                    <SpeakBtn text={q.ex} size={14} />
                  </div>
                )}
                {q.exHeb && <HebText style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{q.exHeb}</HebText>}

                {q.kanjiStory && (
                  <div style={{ marginTop: 16, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "3px solid #7C3AED", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 22, lineHeight: 1.1 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: C.kanji, marginBottom: 4, fontSize: 11 }}>{storyLabel(q.jp)}</div>
                      <div style={{ fontSize: 16, color: "#5B21B6", fontWeight: 500, lineHeight: 1.6 }}>{q.kanjiStory}</div>
                    </div>
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
      })()}
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
