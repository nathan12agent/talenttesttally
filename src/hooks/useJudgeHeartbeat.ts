'use client';

import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const HEARTBEAT_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Writes a heartbeat timestamp to `judges/{judgeId}` every 15 seconds.
 * The admin ConnectionStatusPanel reads `lastSeenAt` to show online/offline
 * indicators without requiring the Firebase Realtime Database.
 */
export function useJudgeHeartbeat(judgeId: string | null) {
  useEffect(() => {
    if (!judgeId) return;

    async function beat() {
      try {
        await setDoc(
          doc(db, 'judges', judgeId!),
          { lastSeenAt: new Date().toISOString() },
          { merge: true },
        );
      } catch {
        // Silently ignore — judge is likely offline; Firestore queues the write
      }
    }

    beat(); // immediate first beat
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [judgeId]);
}
