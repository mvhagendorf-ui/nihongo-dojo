import { useState, useEffect, useCallback, useRef } from "react";
import { CATEGORIES, SIM_GROUPS, ALL_DATA, PASS_SCORE, QUESTIONS_PER_TEST, TIMER_SECONDS } from "./data";
import { playSound } from "./audio";
import { loadHistory, saveSession, updateSRS, getSRSWeights } from "./storage";

const RED = "#BC002D";
const RED_LIGHT = "rgba(188,0,45,0.08)";
const GREEN = "#16a34a";
const GREEN_LIGHT = "rgba(22,163,74,0.08)";

const PAGE = { minHeight: "100dvh", background: "#f5f5f7", color: "#1a1a1a", fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", padding: 20, maxWidth: 700, margin: "0 auto" };
const CARD = { background: "#ffffff", borderRadius: 18, padding: 18, marginBottom: 14, border: "1px solid #e5e5e5", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };

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

function generateChoices(q, pool) {
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

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

let jaVoice = null;
function initVoices() {
  const voices = speechSynthesis.getVoices();
  const ja = voices.filter(v => v.lang.startsWith("ja"));
  jaVoice = ja.find(v => /google|premium|enhanced/i.test(v.name))
    || ja.find(v => !v.localService)
    || ja[0] || null;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  initVoices();
  speechSynthesis.addEventListener("voiceschanged", initVoices);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.85;
  u.pitch = 1.05;
  if (jaVoice) u.voice = jaVoice;
  speechSynthesis.speak(u);
}

function SpeakBtn({ text, size }) {
  return (
    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); speak(text); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); speak(text); } }} style={{ cursor: "pointer", fontSize: size || 18, padding: "0 4px", verticalAlign: "middle", lineHeight: 1, userSelect: "none" }}>
      🔊
    </span>
  );
}

function HebText({ children, style }) {
  return <div dir="rtl" style={{ textAlign: "right", unicodeBidi: "plaintext", ...style }}>{children}</div>;
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

function Leaderboard({ history }) {
  const top = getMostMistaken(history).slice(0, 10);
  if (top.length === 0) return null;
  return (
    <div style={{ ...CARD, marginTop: 14 }}>
      <h3 style={{ color: RED, margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>🏅 Most Mistaken Words</h3>
      {top.map((w, i) => (
        <div key={i} style={{ borderBottom: i < top.length - 1 ? "1px solid #f0f0f0" : "none", padding: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: i < 3 ? RED : "#888", fontSize: 13, fontWeight: 800, minWidth: 18 }}>{i + 1}.</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>{w.jp}</span>
              <SpeakBtn text={w.jp} size={14} />
            </div>
            <span style={{ background: RED_LIGHT, color: RED, fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>×{w.count}</span>
          </div>
          <div style={{ color: "#333", fontSize: 13, marginTop: 2, fontWeight: 600, marginLeft: 24 }}>{w.en}</div>
          {w.heb && <HebText style={{ color: "#555", fontSize: 12, marginTop: 1, marginRight: 0 }}>{w.heb}</HebText>}
          {w.ex && (
            <div style={{ fontSize: 12, marginTop: 3, color: "#555", marginLeft: 24, display: "flex", alignItems: "center", gap: 4 }}>
              📝 {w.ex} <SpeakBtn text={w.ex} size={13} />
            </div>
          )}
          {w.exHeb && <HebText style={{ color: "#777", fontSize: 11, marginTop: 1 }}>🔤 {w.exHeb}</HebText>}
          {w.kanjiStory && <div style={{ fontSize: 11, color: "#8b5cf6", marginTop: 2, fontWeight: 600, marginLeft: 24 }}>🧠 {w.kanjiStory}</div>}
        </div>
      ))}
    </div>
  );
}

function HistoryChart({ history, onBarClick }) {
  if (history.length === 0) return null;
  const recent = history.slice(-5);
  const offset = history.length - recent.length;
  return (
    <div style={{ ...CARD, marginTop: 16, marginBottom: 0 }}>
      <h3 style={{ color: RED, margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>📊 Score History (last {recent.length})</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
        {recent.map((s, i) => {
          const pct = Math.round((s.score / s.total) * 100);
          const passed = pct >= PASS_SCORE;
          const hasDetail = s.wrongList && s.wrongList.length > 0;
          return (
            <div key={i} onClick={() => hasDetail && onBarClick(offset + i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", cursor: hasDetail ? "pointer" : "default" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 28, height: `${pct}%`, minHeight: 4, background: passed ? GREEN : RED, opacity: hasDetail ? 0.85 : 0.45, borderRadius: "4px 4px 0 0", transition: "opacity 0.2s" }} />
              </div>
              <span style={{ fontSize: 9, marginTop: 3, fontWeight: 700, color: passed ? GREEN : RED }}>{pct}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, marginTop: 4, background: "#eee" }} />
    </div>
  );
}

function HistoryModal({ session, onClose }) {
  if (!session) return null;
  const pct = Math.round((session.score / session.total) * 100);
  const d = new Date(session.date);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 20, maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: pct >= PASS_SCORE ? GREEN : RED, fontSize: 24, fontWeight: 900 }}>{pct}%</div>
            <div style={{ color: "#999", fontSize: 11 }}>{d.toLocaleDateString()} · {session.score}/{session.total}</div>
          </div>
          <button onClick={onClose} style={{ background: "#f5f5f5", border: "none", color: "#999", fontSize: 18, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {session.wrongList && session.wrongList.length > 0 ? (
          <>
            <h4 style={{ color: RED, margin: "0 0 10px", fontSize: 13 }}>❌ Wrong Answers ({session.wrongList.length})</h4>
            {session.wrongList.map((w, i) => (
              <div key={i} style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: RED, fontSize: 10, fontWeight: 600 }}>{CATEGORIES[w.cat]}{w.num ? ` · #${w.num}` : ""}</span>
                  <SpeakBtn text={w.jp} size={16} />
                </div>
                <div style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 20, marginTop: 2 }}>{w.jp}</div>
                <div style={{ color: "#333", fontSize: 14, marginTop: 3, fontWeight: 600 }}>{w.en}</div>
                {w.heb && <HebText style={{ color: "#555", fontSize: 13, marginTop: 2 }}>{w.heb}</HebText>}
                {w.conn && <div style={{ color: "#444", fontSize: 12, marginTop: 6, fontWeight: 700 }}>接続: {w.conn}</div>}
                {w.ex && (
                  <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 4 }}>
                    📝 {w.ex} <SpeakBtn text={w.ex} size={14} />
                  </div>
                )}
                {w.exHeb && <HebText style={{ color: "#666", fontSize: 12, marginTop: 2 }}>🔤 {w.exHeb}</HebText>}
                {w.kanjiStory && <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 3, fontWeight: 600 }}>🧠 {w.kanjiStory}</div>}
              </div>
            ))}
          </>
        ) : (
          <p style={{ color: "#999", fontSize: 13, textAlign: "center", margin: "20px 0" }}>No wrong answer data for this session</p>
        )}
      </div>
    </div>
  );
}

export default function App() {
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
    const picked = weightedShuffle(filtered, count);
    setQuestions(picked);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setTotal(0);
    setStreak(0);
    setBestStreak(0);
    setWrongList([]);
    setRetryQueue([]);
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
    setTimeout(() => setShowNext(true), 500);
    // Auto-read example sentence after answering
    const exText = questions[current].ex;
    if (exText) setTimeout(() => speak(exText), 900);
  };

  const next = () => {
    let nextIdx = current + 1;
    if (nextIdx < questions.length) {
      setCurrent(nextIdx);
      setSelected(null);
      setShowNext(false);
      setChoices(generateChoices(questions[nextIdx], ALL_DATA));
    } else if (retryQueue.length > 0) {
      const retry = retryQueue[0];
      setRetryQueue(r => r.slice(1));
      setQuestions(q => [...q, retry]);
      setCurrent(questions.length);
      setSelected(null);
      setShowNext(false);
      setChoices(generateChoices(retry, ALL_DATA));
    } else {
      setTimerActive(false);
      setScreen("results");
    }
  };

  const q = questions[current];
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;
  const filteredCount = ALL_DATA.filter(d => selectedCats.includes(d.cat)).length;

  // ── MENU ──
  if (screen === "menu") {
    return (
      <div style={PAGE}>
        <div style={{ textAlign: "center", marginBottom: 16, paddingTop: 8 }}>
          <img src="/logo.png" alt="日本語道場 Nihongo Dojo" style={{ width: 260, display: "block", margin: "0 auto", mixBlendMode: "multiply" }} />
        </div>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, color: RED, fontWeight: 700 }}>📚 Categories</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelectedCats(Object.keys(CATEGORIES))} style={{ background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#666", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>All</button>
              <button onClick={() => setSelectedCats([])} style={{ background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#666", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>None</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Object.entries(CATEGORIES).map(([key, label]) => {
              const count = ALL_DATA.filter(d => d.cat === key).length;
              const on = selectedCats.includes(key);
              return (
                <button key={key} onClick={() => toggleCat(key)} style={{ background: on ? RED_LIGHT : "#f9f9f9", border: on ? `1px solid ${RED}` : "1px solid #e5e5e5", color: on ? RED : "#999", borderRadius: 8, padding: "5px 9px", fontSize: 11, cursor: "pointer", fontWeight: on ? 600 : 400 }}>
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Questions</span>
            <input type="number" min={Math.min(10, filteredCount)} max={filteredCount} value={Math.min(numQuestions, filteredCount)} onChange={e => { const v = Number(e.target.value); if (v >= 1 && v <= filteredCount) setNumQuestions(v); }} style={{ width: 60, textAlign: "center", color: RED, fontWeight: 900, fontSize: 18, border: `1px solid #e5e5e5`, borderRadius: 8, padding: "2px 6px", outline: "none", background: "#fff" }} />
          </div>
          <input type="range" min={Math.min(10, filteredCount)} max={filteredCount} value={Math.min(numQuestions, filteredCount)} onChange={e => setNumQuestions(Number(e.target.value))} style={{ width: "100%", accentColor: RED, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, marginBottom: 14 }}>
            <span style={{ color: "#bbb", fontSize: 10 }}>{Math.min(10, filteredCount)}</span>
            <span style={{ color: "#bbb", fontSize: 10 }}>{filteredCount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Pass</span>
            <span style={{ color: "#1a1a1a", fontWeight: 800 }}>{PASS_SCORE}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#888", fontSize: 13 }}>Timer</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="number" min={0} max={99} value={timerMin} onChange={e => setTimerMin(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} style={{ width: 44, textAlign: "center", fontWeight: 800, fontSize: 16, border: `1px solid #e5e5e5`, borderRadius: 8, padding: "4px 2px", outline: "none", background: "#fff" }} />
              <span style={{ fontWeight: 800, fontSize: 16 }}>:</span>
              <input type="number" min={0} max={59} value={timerSec.toString().padStart(2, "0")} onChange={e => setTimerSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} style={{ width: 44, textAlign: "center", fontWeight: 800, fontSize: 16, border: `1px solid #e5e5e5`, borderRadius: 8, padding: "4px 2px", outline: "none", background: "#fff" }} />
            </div>
          </div>
        </div>
        <button onClick={startQuiz} disabled={filteredCount < 4} style={{ width: "100%", padding: 16, fontSize: 18, fontWeight: 900, background: filteredCount >= 4 ? RED : "#ddd", color: "#fff", border: "none", borderRadius: 14, cursor: filteredCount >= 4 ? "pointer" : "not-allowed", letterSpacing: 3, boxShadow: filteredCount >= 4 ? "0 4px 14px rgba(188,0,45,0.3)" : "none" }}>
          START TEST
        </button>
        <HistoryChart history={history} onBarClick={(idx) => setHistoryModal(history[idx])} />
        {history.length > 0 && (
          <p style={{ textAlign: "center", color: "#999", fontSize: 11, marginTop: 10 }}>
            {history.length} tests · avg {Math.round(history.reduce((s, h) => s + (h.score / h.total) * 100, 0) / history.length)}%
          </p>
        )}
        <Leaderboard history={history} />
        {historyModal && <HistoryModal session={historyModal} onClose={() => setHistoryModal(null)} />}
      </div>
    );
  }

  // ── RESULTS ──
  if (screen === "results") {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= PASS_SCORE;
    return (
      <div style={PAGE}>
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <div style={{ fontSize: 52 }}>{passed ? "🏆" : "📖"}</div>
          <div style={{ fontSize: 52, fontWeight: 900, color: passed ? GREEN : RED }}>{pct}%</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: passed ? GREEN : RED }}>{passed ? "合格！PASSED!" : "不合格 — RETRY"}</div>
          <p style={{ color: "#888", fontSize: 14 }}>{score} / {total} correct</p>
          <p style={{ color: "#aaa", fontSize: 12 }}>Best streak: {bestStreak} · Time: {formatTime((timerMin * 60 + timerSec) - timeLeft)}</p>
        </div>
        {wrongList.length > 0 && (
          <div style={{ ...CARD, marginTop: 20, background: "#fff8f8", border: "1px solid rgba(188,0,45,0.15)" }}>
            <h3 style={{ color: RED, margin: "0 0 10px", fontSize: 14 }}>❌ Review ({wrongList.length})</h3>
            {wrongList.map((w, i) => (
              <div key={i} style={{ borderBottom: "1px solid #f0e0e0", padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: RED, fontSize: 10, fontWeight: 600 }}>{CATEGORIES[w.cat]}{w.num ? ` · #${w.num}` : ""}</span>
                  <SpeakBtn text={w.jp} size={16} />
                </div>
                <div style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 20, marginTop: 2 }}>{w.jp}</div>
                <div style={{ color: "#333", fontSize: 14, marginTop: 3, fontWeight: 600 }}>{w.en}</div>
                {w.heb && <HebText style={{ color: "#555", fontSize: 13, marginTop: 2 }}>{w.heb}</HebText>}
                {w.conn && <div style={{ color: "#444", fontSize: 12, marginTop: 6, fontWeight: 700 }}>接続: {w.conn}</div>}
                {w.ex && (
                  <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 4 }}>
                    📝 {w.ex} <SpeakBtn text={w.ex} size={14} />
                  </div>
                )}
                {w.exHeb && <HebText style={{ color: "#666", fontSize: 12, marginTop: 2 }}>🔤 {w.exHeb}</HebText>}
                {w.kanjiStory && <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 3, fontWeight: 600 }}>🧠 {w.kanjiStory}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setScreen("menu")} style={{ flex: 1, padding: 14, fontSize: 14, background: "#f0f0f0", color: "#333", border: "1px solid #e0e0e0", borderRadius: 12, cursor: "pointer", fontWeight: 600 }}>Menu</button>
          <button onClick={startQuiz} style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: 800, background: RED, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 14px rgba(188,0,45,0.3)" }}>{passed ? "Next Test" : "Retry"}</button>
        </div>
      </div>
    );
  }

  // ── QUIZ ──
  const nums = ["①", "②", "③", "④"];
  const timerWarn = timeLeft < 120;
  return (
    <div style={PAGE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => { setTimerActive(false); setScreen("results"); }} style={{ background: "none", border: "none", color: "#999", fontSize: 14, cursor: "pointer", padding: 0 }}>← End</button>
        <div style={{ color: timerWarn ? RED : "#666", fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>⏱ {formatTime(timeLeft)}</div>
        <div style={{ color: "#666", fontSize: 14, fontWeight: 600 }}>{current + 1}/{questions.length}</div>
      </div>
      <div style={{ height: 4, background: "#e0e0e0", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: RED, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: "#888", fontSize: 14 }}>{score}/{total} {total > 0 ? `(${Math.round((score / total) * 100)}%)` : ""}</div>
        <div style={{ color: RED, fontSize: 16, fontWeight: 800 }}>{streak > 2 ? `🔥 ${streak}` : ""}</div>
      </div>
      {q && (
        <>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span style={{ background: RED_LIGHT, color: RED, fontSize: 12, padding: "4px 14px", borderRadius: 8, fontWeight: 600 }}>
              {CATEGORIES[q.cat]}{q.num ? ` · #${q.num}` : ""}
            </span>
          </div>
          <div style={{ background: "#fff", borderRadius: 20, padding: "30px 22px", textAlign: "center", marginBottom: 14, border: "1px solid #e5e5e5", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.3 }}>
              {q.jp} <SpeakBtn text={q.jp} size={26} />
            </div>
            {q.conn && <div style={{ color: "#555", fontSize: 15, marginTop: 12, fontWeight: 700 }}>接続: {q.conn}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {choices.map((c, i) => {
              let bg = "#ffffff";
              let border = "1px solid #e5e5e5";
              let col = "#1a1a1a";
              let fw = 500;
              let shadow = "0 1px 3px rgba(0,0,0,0.04)";
              if (selected) {
                if (c.jp === q.jp) { bg = GREEN_LIGHT; border = `2px solid ${GREEN}`; col = GREEN; fw = 700; shadow = "0 2px 8px rgba(22,163,74,0.15)"; }
                else if (c.jp === selected.jp && c.jp !== q.jp) { bg = RED_LIGHT; border = `2px solid ${RED}`; col = RED; shadow = "0 2px 8px rgba(188,0,45,0.15)"; }
                else { col = "#bbb"; bg = "#fafafa"; border = "1px solid #eee"; shadow = "none"; }
              }
              return (
                <button key={i} onClick={() => handleChoice(c)} style={{ background: bg, border, color: col, borderRadius: 14, padding: "14px 18px", fontSize: 16, cursor: selected ? "default" : "pointer", textAlign: "left", transition: "all 0.2s", fontWeight: fw, display: "flex", gap: 12, alignItems: "flex-start", fontFamily: "inherit", boxShadow: shadow }}>
                  <span style={{ color: selected ? col : "#bbb", fontWeight: 700, fontSize: 18, minWidth: 26 }}>{nums[i]}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: fw }}>{c.en}</div>
                    {c.heb && <HebText style={{ fontSize: 14, marginTop: 3, color: selected ? col : "#888" }}>{c.heb}</HebText>}
                  </div>
                </button>
              );
            })}
          </div>
          {selected && (
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", marginTop: 12, border: "1px solid #e5e5e5", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {q.conn && <div style={{ fontSize: 15, color: "#444", fontWeight: 800, marginBottom: 6 }}>接続: {q.conn}</div>}
              {q.ex && (
                <div style={{ fontSize: 16, color: "#1a1a1a", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  📝 {q.ex} <SpeakBtn text={q.ex} size={18} />
                </div>
              )}
              {q.exHeb && <HebText style={{ fontSize: 15, color: "#666", marginTop: 4 }}>🔤 {q.exHeb}</HebText>}
              {q.kanjiStory && <div style={{ fontSize: 15, color: "#8b5cf6", marginTop: 5, fontWeight: 600 }}>🧠 {q.kanjiStory}</div>}
            </div>
          )}
          {showNext && (
            <button onClick={next} style={{ width: "100%", marginTop: 12, padding: 16, fontSize: 18, fontWeight: 800, background: RED, color: "#fff", border: "none", borderRadius: 16, cursor: "pointer", letterSpacing: 1, fontFamily: "inherit", boxShadow: "0 4px 14px rgba(188,0,45,0.3)" }}>
              {current + 1 >= questions.length && retryQueue.length === 0 ? "Results →" : retryQueue.length > 0 && current + 1 >= questions.length ? `Retry (${retryQueue.length}) →` : "Next →"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
