const HISTORY_KEY = "nihongo_dojo_history";
const SRS_KEY = "nihongo_dojo_srs";

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch { return []; }
}

export function saveSession(session) {
  const history = loadHistory();
  history.push({ ...session, date: new Date().toISOString() });
  if (history.length > 100) history.splice(0, history.length - 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadSRS() {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY)) || {};
  } catch { return {}; }
}

export function updateSRS(jp, correct) {
  const srs = loadSRS();
  if (!srs[jp]) srs[jp] = { wrong: 0, right: 0, last: 0 };
  if (correct) srs[jp].right++;
  else srs[jp].wrong++;
  srs[jp].last = Date.now();
  localStorage.setItem(SRS_KEY, JSON.stringify(srs));
  return srs;
}

export function getSRSWeights(items) {
  const srs = loadSRS();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  return items.map(item => {
    const pinBoost = item.pin ? 5 : 1;  // top-priority items hit much more often
    const data = srs[item.jp];
    // Never asked before → highest priority
    if (!data) return { item, weight: 4 * pinBoost };
    const errorRate = data.wrong / Math.max(1, data.wrong + data.right);
    const base = 1 + errorRate * 4;  // 1-5 based on error rate
    const daysSince = (now - (data.last || 0)) / DAY;
    // Recency multiplier: items asked long ago get boosted
    let recencyBoost;
    if (daysSince > 14) recencyBoost = 2.0;
    else if (daysSince > 7) recencyBoost = 1.6;
    else if (daysSince > 3) recencyBoost = 1.3;
    else if (daysSince > 1) recencyBoost = 1.0;
    else if (daysSince > 0.2) recencyBoost = 0.7;
    else recencyBoost = 0.4;  // asked very recently → low priority
    return { item, weight: base * recencyBoost * pinBoost };
  });
}
