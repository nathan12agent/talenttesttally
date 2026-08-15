'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Returns true when Firestore has a live server connection.
 * Uses snapshot metadata on a lightweight probe doc — when offline,
 * Firestore serves snapshots from cache (fromCache = true).
 */
export function useConnectionStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, '_connectionProbe', 'probe'),
      { includeMetadataChanges: true },
      (snap) => {
        // fromCache=false means we have a live server response → online
        setIsConnected(!snap.metadata.fromCache);
      },
      () => {
        // Error callback → treat as offline
        setIsConnected(false);
      },
    );
    return unsubscribe;
  }, []);

  return isConnected;
}
