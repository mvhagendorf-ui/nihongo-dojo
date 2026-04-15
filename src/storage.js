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
  return items.map(item => {
    const data = srs[item.jp];
    if (!data) return { item, weight: 1 };
    const errorRate = data.wrong / Math.max(1, data.wrong + data.right);
    return { item, weight: 1 + errorRate * 4 };
  });
}
