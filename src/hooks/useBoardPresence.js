import { useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isFirestoreBackend } from '@/api/base44Client';

const HEARTBEAT_MS = 20_000;
/** If no heartbeat within this window, treat as offline (background tabs can throttle timers). */
const STALE_MS = 120_000;
/** Re-check staleness clock without touching React unless membership/display fields change. */
const STALE_TICK_MS = 10_000;

/** Normalize Firestore Timestamp, plain {seconds,nanoseconds}, ISO string, etc. */
function updatedAtToMillis(value) {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const ns = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(ns / 1e6);
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function tabPresenceId() {
  try {
    let id = sessionStorage.getItem('huddl-presence-tab-id');
    if (!id) {
      id = `tab-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
      sessionStorage.setItem('huddl-presence-tab-id', id);
    }
    return id;
  } catch {
    return `tab-${Date.now()}`;
  }
}

/**
 * Identity of the rendered online list — the fields {@link BoardOnlineIndicator} actually draws,
 * ignoring heartbeat-only `lastSeenMs` churn. Shared with the component so both sides agree on
 * what counts as a change rather than keeping two copies of the rule.
 */
export function onlineListDisplaySignature(rows) {
  const sorted = [...rows].sort((a, b) =>
    String(a.email ?? a.uid).localeCompare(String(b.email ?? b.uid), undefined, { sensitivity: 'base' })
  );
  return sorted
    .map((u) => [u.uid, u.email ?? '', u.display_name ?? '', u.photo_url ?? ''].join('\u0001'))
    .join('\u0002');
}

function filterFreshPresenceRows(now, rawMap) {
  const out = [];
  rawMap.forEach((row) => {
    const t = row.lastSeenMs;
    if (typeof t === 'number' && t > 0 && now - t < STALE_MS) out.push(row);
  });
  out.sort((a, b) =>
    String(a.email ?? a.uid).localeCompare(String(b.email ?? b.uid), undefined, { sensitivity: 'base' })
  );
  return out;
}

/**
 * Tracks who is currently viewing a board (heartbeat + live listener).
 * Firestore: `boards/{boardId}/presence/{uid}`. Local backend: BroadcastChannel (same browser / machine).
 *
 * @param {{ boardId: string|null|undefined, enabled: boolean, sessionUser: { uid?: string|null, email?: string|null, full_name?: string|null, photoURL?: string|null }|null }} args
 * @returns {{ onlineUsers: Array<{ uid: string, email: string|null, display_name: string|null, photo_url: string|null, lastSeenMs: number }>, myPresenceUid: string|null }}
 */
export function useBoardPresence({ boardId, enabled, sessionUser }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [myPresenceUid, setMyPresenceUid] = useState(null);

  const presenceMapRef = useRef(new Map());
  const lastOnlineListSigRef = useRef('');
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  /*
   * Display fields live in a ref, not in the subscription's deps. Keying the effect on them meant
   * editing your name or avatar tore the whole subscription down — deleting your presence doc and
   * resubscribing — so you blinked out of your own list just for changing a photo. The heartbeat
   * reads current values through this ref instead, and the effect below pushes an immediate
   * refresh when they change.
   */
  const sessionUserRef = useRef(sessionUser);
  sessionUserRef.current = sessionUser;
  const writePresenceRef = useRef(null);

  const emitOnlineUsersIfChanged = (rawMap) => {
    if (!enabledRef.current) return;
    const now = Date.now();
    const out = filterFreshPresenceRows(now, rawMap);
    const sig = onlineListDisplaySignature(out);
    if (sig !== lastOnlineListSigRef.current) {
      lastOnlineListSigRef.current = sig;
      setOnlineUsers(out);
    }
  };

  useEffect(() => {
    lastOnlineListSigRef.current = '';
    setOnlineUsers([]);
    presenceMapRef.current = new Map();
  }, [boardId]);

  useEffect(() => {
    if (!enabled) {
      lastOnlineListSigRef.current = '';
      setOnlineUsers([]);
      presenceMapRef.current = new Map();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !boardId) {
      setMyPresenceUid(null);
      return undefined;
    }

    const firestoreUid = sessionUser?.uid ?? null;
    if (isFirestoreBackend && db && firestoreUid) {
      setMyPresenceUid(firestoreUid);
      const presCol = collection(db, 'boards', boardId, 'presence');
      const myRef = doc(db, 'boards', boardId, 'presence', firestoreUid);

      const writePresence = () => {
        const u = sessionUserRef.current;
        setDoc(
          myRef,
          {
            updated_at: serverTimestamp(),
            email: u?.email || null,
            display_name: u?.full_name || null,
            photo_url: u?.photoURL || null,
          },
          { merge: true }
        ).catch((e) => {
          if (import.meta.env.DEV) console.warn('[Huddl] board presence write failed', e);
        });
      };
      writePresenceRef.current = writePresence;

      writePresence();
      const hb = setInterval(writePresence, HEARTBEAT_MS);
      const onVisibility = () => {
        if (document.visibilityState === 'visible') writePresence();
      };
      document.addEventListener('visibilitychange', onVisibility);

      /*
       * Effect cleanup does not run when a tab is closed, so without this you lingered in
       * everyone's "Online" for the full STALE_MS window after leaving. `pagehide` covers close,
       * reload and navigation; a crash or dropped connection still falls back to the staleness
       * sweep, which Firestore gives no way to avoid (there is no onDisconnect outside RTDB).
       * If the page comes back from bfcache the next heartbeat re-creates the doc.
       */
      const onPageHide = () => {
        deleteDoc(myRef).catch(() => {});
      };
      window.addEventListener('pagehide', onPageHide);

      const unsub = onSnapshot(
        presCol,
        (snap) => {
          const m = new Map();
          snap.forEach((d) => {
            /*
             * `estimate` matters here. Each heartbeat writes `serverTimestamp()`, and Firestore
             * echoes the write locally before the server acknowledges it. Read with the default
             * (`none`), a pending timestamp comes back as null → lastSeenMs 0 → the row fails the
             * freshness check and the writer drops out of their own online list until the ack
             * lands. That blinked every heartbeat, and unmounted the whole indicator when you
             * were the only viewer. `estimate` fills in the local clock instead.
             */
            const data = d.data({ serverTimestamps: 'estimate' });
            const ts = updatedAtToMillis(data.updated_at);
            m.set(d.id, {
              uid: d.id,
              email: typeof data.email === 'string' ? data.email : null,
              display_name: typeof data.display_name === 'string' ? data.display_name : null,
              photo_url: typeof data.photo_url === 'string' ? data.photo_url : null,
              lastSeenMs: ts ?? 0,
            });
          });
          presenceMapRef.current = m;
          emitOnlineUsersIfChanged(m);
        },
        (err) => {
          if (import.meta.env.DEV) console.warn('[Huddl] board presence listener', err);
        }
      );

      const staleInterval = setInterval(() => {
        emitOnlineUsersIfChanged(presenceMapRef.current);
      }, STALE_TICK_MS);

      return () => {
        clearInterval(hb);
        clearInterval(staleInterval);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        writePresenceRef.current = null;
        unsub();
        deleteDoc(myRef).catch(() => {});
        setMyPresenceUid(null);
      };
    }

    if (!isFirestoreBackend && typeof BroadcastChannel !== 'undefined') {
      const synthetic = tabPresenceId();
      setMyPresenceUid(synthetic);
      const channel = new BroadcastChannel(`huddl-board-presence:${boardId}`);
      presenceMapRef.current = new Map();

      const broadcast = () => {
        const u = sessionUserRef.current;
        channel.postMessage({
          type: 'hb',
          uid: synthetic,
          email: u?.email || 'user@localhost.local',
          display_name: u?.full_name || 'Local User',
          photo_url: u?.photoURL || null,
          ts: Date.now(),
        });
      };
      writePresenceRef.current = broadcast;

      const onMsg = (ev) => {
        const data = ev?.data;
        if (!data) return;
        if (data.type === 'leave' && data.uid) {
          presenceMapRef.current.delete(data.uid);
          emitOnlineUsersIfChanged(presenceMapRef.current);
          return;
        }
        if (data.type !== 'hb' || !data.uid) return;
        presenceMapRef.current.set(data.uid, {
          uid: data.uid,
          email: typeof data.email === 'string' ? data.email : null,
          display_name: typeof data.display_name === 'string' ? data.display_name : null,
          photo_url: typeof data.photo_url === 'string' ? data.photo_url : null,
          lastSeenMs: data.ts,
        });
        emitOnlineUsersIfChanged(presenceMapRef.current);
      };

      const announceLeave = () => {
        try {
          channel.postMessage({ type: 'leave', uid: synthetic });
        } catch {
          /* channel already closed */
        }
      };

      channel.addEventListener('message', onMsg);
      broadcast();
      const hb = setInterval(broadcast, HEARTBEAT_MS);
      const staleInterval = setInterval(() => {
        emitOnlineUsersIfChanged(presenceMapRef.current);
      }, STALE_TICK_MS);
      // Same reasoning as the Firestore branch: cleanup does not run on tab close.
      window.addEventListener('pagehide', announceLeave);

      return () => {
        clearInterval(hb);
        clearInterval(staleInterval);
        channel.removeEventListener('message', onMsg);
        window.removeEventListener('pagehide', announceLeave);
        writePresenceRef.current = null;
        announceLeave();
        channel.close();
        setMyPresenceUid(null);
      };
    }

    setMyPresenceUid(null);
    return undefined;
    // `isFirestoreBackend` is a module constant, not reactive state — listing it implied otherwise.
  }, [enabled, boardId, sessionUser?.uid]);

  /*
   * Display fields deliberately sit outside the subscription's deps (see sessionUserRef), so push
   * a heartbeat when they change. Declared after the subscription effect so the ref is populated
   * by the time this runs; the first run is skipped because that effect has just written.
   */
  const displayFieldsSettledRef = useRef(false);
  useEffect(() => {
    if (!displayFieldsSettledRef.current) {
      displayFieldsSettledRef.current = true;
      return;
    }
    writePresenceRef.current?.();
  }, [sessionUser?.email, sessionUser?.full_name, sessionUser?.photoURL]);

  return { onlineUsers, myPresenceUid };
}
