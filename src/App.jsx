import { useState, useEffect, useCallback, useRef } from "react";
import { CATEGORIES, CATEGORY_GROUPS, SIM_GROUPS, ALL_DATA, PASS_SCORE, QUESTIONS_PER_TEST, TIMER_SECONDS } from "./data";
import { playSound } from "./audio";
import { loadHistory, saveSession, updateSRS, getSRSWeights } from "./storage";

// ─────────── DESIGN TOKENS ───────────
const C = {
  bg: "#FAF7F3",
  surface: "#FFFFFF",
  elevated: "#F5F2EC",
  mutedBg: "#F2EEE7",
  border: "#E4DFD4",
  borderStrong: "#CFC9BC",
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
    <div className={className} style={{ background: elevated ? C.elevated : C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: flush ? 0 : 18, ...style }}>
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", ...style }}>
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
                  <div className="jp" style={{ fontSize: t.meta, marginTop: 8, color: C.inkDim, display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.55 }}>
                    <span style={{ ...KICKER, fontSize: 9, marginTop: 3, color: C.faint }}>例</span>
                    <span style={{ flex: 1 }}>{w.ex}</span>
                    <SpeakBtn text={w.ex} size={12} />
                  </div>
                )}
                {t.showAll && w.exHeb && <HebText style={{ color: C.muted, fontSize: t.meta - 1, marginTop: 3 }}>{w.exHeb}</HebText>}
                {t.showAll && w.kanjiStory && (
                  <div style={{ marginTop: 8, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "2px solid #7C3AED", padding: "7px 10px", borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 13, lineHeight: 1.2 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: C.kanji, fontSize: 9, marginBottom: 2 }}>Kanji Story</div>
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
      <div className="jp" style={{ color: C.ink, fontWeight: 700, fontSize: 20, marginTop: 8, letterSpacing: "0.02em" }}>{w.jp}</div>
      <div style={{ color: C.inkDim, fontSize: 14, marginTop: 3 }}>{w.en}</div>
      {w.heb && <HebText style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{w.heb}</HebText>}
      {w.conn && <div style={{ fontSize: 12, marginTop: 8, color: C.muted }}><span style={{ color: C.faint, marginRight: 6 }}>接続</span><ColoredConn conn={w.conn} /></div>}
      {w.ex && (
        <div className="jp" style={{ fontSize: 13, marginTop: 8, color: C.inkDim, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: C.faint }}>例</span> {w.ex} <SpeakBtn text={w.ex} size={12} />
        </div>
      )}
      {w.exHeb && <HebText style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{w.exHeb}</HebText>}
      {w.kanjiStory && (
        <div style={{ marginTop: 10, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "2px solid #7C3AED", padding: "8px 12px", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 14, lineHeight: 1.2 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ ...KICKER, color: C.kanji, fontSize: 9, marginBottom: 2 }}>Kanji Story</div>
            <div style={{ fontSize: 13, color: "#5B21B6", fontWeight: 500, lineHeight: 1.5 }}>{w.kanjiStory}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── APP ───────────
export default function App() {
  const wide = useIsWide();
  const PAGE = { minHeight: "100dvh", padding: wide ? "32px 40px 48px" : "18px 18px 40px", maxWidth: wide ? 1180 : 560, margin: "0 auto", color: C.ink, fontFamily: FONT_LATIN };

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
  const [historyModal, setHistoryModal] = useState(null);
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
      const slimWrong = wrongList.map(w => ({ jp: w.jp, en: w.en, heb: w.heb, cat: w.cat, num: w.num, conn: w.conn, ex: w.ex, exHeb: w.exHeb, kanjiStory: w.kanjiStory }));
      saveSession({ score, total, bestStreak, cats: selectedCats, wrongList: slimWrong });
      setHistory(loadHistory());
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
    setChoices(generateChoices(picked[0], ALL_DATA));
    savedRef.current = false;
    setScreen("quiz");
  }, [selectedCats, numQuestions, timerMin, timerSec]);

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
      setChoices(generateChoices(questions[nextIdx], ALL_DATA));
    } else if (retryQueue.length > 0) {
      const retry = retryQueue[0];
      setRetryQueue(r => r.slice(1));
      setQuestions(q => [...q, retry]);
      setCurrent(questions.length);
      setSelected(null); setShowNext(false);
      setChoices(generateChoices(retry, ALL_DATA));
    } else {
      setTimerActive(false); setScreen("results");
    }
  };

  const kbRef = useRef({});
  kbRef.current = { selected, showNext, choices, handleChoice, next };
  useEffect(() => {
    if (screen !== "quiz") return;
    const handler = (e) => {
      const s = kbRef.current;
      if (e.key >= "1" && e.key <= "4" && !s.selected && s.choices.length > 0) {
        const idx = parseInt(e.key, 10) - 1;
        if (s.choices[idx]) { e.preventDefault(); s.handleChoice(s.choices[idx]); }
      } else if (e.key === "Enter" && s.showNext) {
        e.preventDefault(); s.next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  const q = questions[current];
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;
  const filteredCount = ALL_DATA.filter(d => selectedCats.includes(d.cat)).length;

  // ═════════ MENU ═════════
  if (screen === "menu") {
    const totalItems = ALL_DATA.length;
    const avg = history.length > 0 ? Math.round(history.reduce((s, h) => s + (h.score / h.total) * 100, 0) / history.length) : 0;
    return (
      <div style={PAGE}>
        {/* HEADER */}
        <header style={{ textAlign: "center", marginBottom: wide ? 32 : 24, paddingTop: 4 }}>
          <div className="logo-wrap" role="button" tabIndex={0} aria-label="日本語道場" style={{ width: wide ? 280 : 220, height: wide ? 280 : 220, margin: "0 auto 10px" }}>
            <img className="logo-img" src="/logo.png" alt="日本語道場" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 4px 20px rgba(188,0,45,0.22))" }} />
            <svg className="logo-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" /></svg>
          </div>
          <div style={{ ...KICKER, color: C.faint, marginTop: 6 }}>
            N2 / N1 · {totalItems} items{history.length > 0 ? ` · ${history.length} tests · avg ${avg}%` : ""}
          </div>
        </header>

        <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" } : {}}>
          {/* CATEGORIES */}
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
                      <span className="jp" style={{ flex: 1, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit", letterSpacing: "0.02em" }}>
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
                <input type="range" min={Math.min(10, filteredCount)} max={filteredCount} value={Math.min(numQuestions, filteredCount)} onChange={e => setNumQuestions(Number(e.target.value))} style={{ width: "100%", cursor: "pointer", marginTop: 4 }} />
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
          </div>
        </div>

        {/* HISTORY + LEADERBOARD */}
        <div style={{ ...(wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 } : {}), marginTop: 18, display: wide ? "grid" : "flex", flexDirection: wide ? undefined : "column", gap: wide ? 18 : 14 }}>
          <HistoryChart history={history} onBarClick={(idx) => setHistoryModal(history[idx])} />
          <Leaderboard history={history} />
        </div>

        {historyModal && <HistoryModal session={historyModal} onClose={() => setHistoryModal(null)} />}
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
                  <div className="jp-display" style={{ fontSize: wide ? 30 : 24, fontWeight: 500, color: C.ink, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                    {blanked} <SpeakBtn text={q.ex.replace(qCore, "・・・")} size={18} />
                  </div>
                  <div style={{ ...KICKER, marginTop: 18, color: C.faint }}>Fill the blank</div>
                </>
              ) : (
                <>
                  <div className="jp-display" style={{ fontSize: wide ? 48 : 36, fontWeight: 500, color: C.ink, lineHeight: 1.4, letterSpacing: "0.05em" }}>
                    {q.jp} <SpeakBtn text={q.jp} size={wide ? 24 : 20} />
                  </div>
                  {q.conn && (
                    <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", background: C.mutedBg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                      <span style={{ ...KICKER, fontSize: 10, color: C.faint }}>接続</span>
                      <span className="jp" style={{ fontSize: 13, fontWeight: 600 }}><ColoredConn conn={q.conn} /></span>
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
                      color: col, borderRadius: 10, padding: "14px 16px",
                      textAlign: "left", cursor: selected ? "default" : "pointer",
                      display: "flex", gap: 14, alignItems: "flex-start",
                      fontFamily: FONT_LATIN, animation: anim, transition: "background 0.2s, border 0.2s, color 0.2s",
                    }}
                  >
                    <span className="num" style={{ color: selected ? col : C.faint, fontWeight: 400, fontSize: 13, minWidth: 20, paddingTop: 2 }}>
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isFill ? (
                        <>
                          <div className="jp" style={{ fontSize: 18, fontWeight: 700, color: selected ? col : C.ink }}>{choiceCore}</div>
                          {selected && <div style={{ fontSize: 12, marginTop: 4, color: col, opacity: 0.85 }}>{c.en}</div>}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 500, color: selected ? col : C.ink, lineHeight: 1.45 }}>{c.en}</div>
                          {c.heb && <HebText style={{ fontSize: 13, marginTop: 3, color: selected ? col : C.muted, opacity: selected ? 0.85 : 1 }}>{c.heb}</HebText>}
                        </>
                      )}
                    </div>
                    {selected && isCorrect && <IconCheck size={16} style={{ color: C.pass, marginTop: 2 }} />}
                    {selected && isWrong && <IconX size={16} style={{ color: C.accent, marginTop: 2 }} />}
                  </button>
                );
              })}
            </div>

            {/* REVEAL PANEL */}
            {selected && (
              <div className="slide-up" style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <KickerLabel style={{ color: C.pass, marginBottom: 10 }}>Answer</KickerLabel>
                <div className="jp" style={{ fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>{q.jp} <SpeakBtn text={q.jp} size={14} /></div>
                <div style={{ color: C.inkDim, fontSize: 14, marginTop: 4 }}>{q.en}</div>
                {q.heb && <HebText style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{q.heb}</HebText>}

                {q.conn && (
                  <div style={{ fontSize: 12, marginTop: 10, color: C.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ ...KICKER, fontSize: 10 }}>接続</span> <span className="jp" style={{ fontSize: 13 }}><ColoredConn conn={q.conn} /></span>
                  </div>
                )}

                {q.ex && (
                  <div className="jp" style={{ fontSize: 14, marginTop: 12, color: C.inkDim, display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap", lineHeight: 1.6 }}>
                    <span style={{ ...KICKER, fontSize: 10, marginTop: 2 }}>例</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {isFill && qCore ? q.ex.split(qCore).map((part, idx, arr) => (
                        <span key={idx}>{part}{idx < arr.length - 1 && <span style={{ background: C.passSoft, color: C.pass, padding: "1px 6px", borderRadius: 3, fontWeight: 700, border: `1px solid ${C.passLine}` }}>{qCore}</span>}</span>
                      )) : q.ex}
                    </span>
                    <SpeakBtn text={q.ex} size={14} />
                  </div>
                )}
                {q.exHeb && <HebText style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{q.exHeb}</HebText>}

                {q.kanjiStory && (
                  <div style={{ marginTop: 14, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderLeft: "3px solid #7C3AED", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18, lineHeight: 1.1 }}>🧠</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...KICKER, color: C.kanji, marginBottom: 4, fontSize: 10 }}>Kanji Story</div>
                      <div style={{ fontSize: 14, color: "#5B21B6", fontWeight: 500, lineHeight: 1.55 }}>{q.kanjiStory}</div>
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
                <kbd>1&ndash;4</kbd> to answer · <kbd>Enter</kbd> to continue
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
