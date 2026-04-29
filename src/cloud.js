// Cloud sync via Supabase. Gracefully no-ops if env vars are missing,
// so the app keeps working with localStorage-only.
//
// SETUP (one time, ~5 min):
// 1. Create a free project at supabase.com (sign up with GitHub)
// 2. In SQL Editor, run:
//      create table if not exists user_data (
//        user_id uuid primary key references auth.users(id) on delete cascade,
//        history jsonb default '[]'::jsonb,
//        srs jsonb default '{}'::jsonb,
//        bookmarks jsonb default '[]'::jsonb,
//        updated_at timestamptz default now()
//      );
//      alter table user_data enable row level security;
//      create policy "users own data" on user_data for all
//        using (auth.uid() = user_id) with check (auth.uid() = user_id);
// 3. In Project Settings → API, copy "URL" and "anon public" key
// 4. In Vercel → Project → Settings → Environment Variables, add:
//      VITE_SUPABASE_URL = <your URL>
//      VITE_SUPABASE_ANON_KEY = <anon key>
// 5. Redeploy. Done.

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (URL && KEY) ? createClient(URL, KEY) : null;
export const cloudEnabled = !!supabase;

// ─────────── AUTH ───────────
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error("Cloud sync isn't configured yet.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  if (!supabase) throw new Error("Cloud sync isn't configured yet.");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data?.subscription?.unsubscribe?.();
}

// ─────────── SYNC ───────────
export async function fetchCloud(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_data")
    .select("history, srs, bookmarks")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || { history: [], srs: {}, bookmarks: [] };
}

export async function pushCloud(userId, payload) {
  if (!supabase) return;
  const { error } = await supabase.from("user_data").upsert({
    user_id: userId,
    history: payload.history || [],
    srs: payload.srs || {},
    bookmarks: [...(payload.bookmarks || [])],
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Debounced push so rapid edits don't spam the network
let pendingTimer = null;
let pendingPayload = null;
export function scheduleSync(userId, payload) {
  if (!cloudEnabled || !userId) return;
  pendingPayload = payload;
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(async () => {
    try { await pushCloud(userId, pendingPayload); }
    catch (e) { console.warn("[cloud] push failed:", e?.message || e); }
  }, 1500);
}

// ─────────── MERGE (local + cloud → merged) ───────────
export function mergeSRS(local, cloud) {
  const merged = { ...(local || {}) };
  for (const key in (cloud || {})) {
    if (!merged[key]) merged[key] = cloud[key];
    else {
      merged[key] = {
        wrong: Math.max(merged[key].wrong || 0, cloud[key].wrong || 0),
        right: Math.max(merged[key].right || 0, cloud[key].right || 0),
        last:  Math.max(merged[key].last  || 0, cloud[key].last  || 0),
      };
    }
  }
  return merged;
}

export function mergeHistory(local, cloud) {
  const seen = new Set();
  const merged = [];
  [...(local || []), ...(cloud || [])].forEach(s => {
    if (!s?.date || seen.has(s.date)) return;
    seen.add(s.date);
    merged.push(s);
  });
  return merged.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function mergeBookmarks(local, cloud) {
  return [...new Set([...(local || []), ...(cloud || [])])];
}
