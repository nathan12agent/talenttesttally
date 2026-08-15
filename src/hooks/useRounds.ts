'use client';
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RoundDoc } from '../types';

export function useRounds(judgeId?: string): RoundDoc[] {
  const [rounds, setRounds] = useState<RoundDoc[]>([]);

  useEffect(() => {
    const roundsRef = collection(db, 'eventRounds');

    const q =
      judgeId
        ? query(
            roundsRef,
            where('status', '==', 'live'),
            where('assignedJudgeIds', 'array-contains', judgeId),
            orderBy('scheduledOrder'),
          )
        : query(
            roundsRef,
            orderBy('scheduledOrder', 'asc'),
          );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRounds(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as RoundDoc)),
      );
    });

    return unsubscribe;
  }, [judgeId]);

  return rounds;
}
