import { supabase } from '../supabase';

// ── Why a heartbeat, not a beforeunload listener? ──────────────────────────
// beforeunload fires on a refresh too, and fires *before* the reload finishes,
// so there's no reliable way to tell "tab closing for good" apart from
// "tab about to reload" at unload time — especially on mobile browsers, which
// don't fire it consistently at all.
//
// Instead, every open tab stamps a "last alive" timestamp into localStorage
// every few seconds. When the app boots (page load / new tab), it checks how
// long ago that timestamp was written:
//   - Tiny gap  (refresh, or another tab is still open and heartbeating) → keep session
//   - Big gap   (nothing was heartbeating — the browser was actually closed) → log out
//
// This also makes multi-tab and multi-device usage work correctly: any open
// tab on this device keeps the heartbeat alive for all of them, and each
// device tracks its own heartbeat independently in its own localStorage.

const HEARTBEAT_KEY = 'mauli_decor_last_heartbeat';
const HEARTBEAT_INTERVAL_MS = 5000;   // write every 5s while a tab is open
const CLOSED_THRESHOLD_MS = 20000;    // gap longer than this = browser was closed

export async function initSessionGuard() {
  const lastBeat = parseInt(localStorage.getItem(HEARTBEAT_KEY) || '0', 10);
  const gap = Date.now() - lastBeat;

  if (lastBeat && gap > CLOSED_THRESHOLD_MS) {
    // No tab kept the heartbeat alive for a while — the browser/all tabs were closed.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Session guard: sign-out on stale session failed', err);
    }
  }

  // Start (or restart) this tab's heartbeat.
  localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
  setInterval(() => {
    localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
  }, HEARTBEAT_INTERVAL_MS);
}