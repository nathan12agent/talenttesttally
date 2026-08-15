'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ScoreDoc } from '../types';

export function useScores(roundId: string): ScoreDoc[] {
  const [scores, setScores] = useState<ScoreDoc[]>([]);

  useEffect(() => {
    if (!roundId) return;

    const q = query(
      collection(db, 'scores'),
      where('roundId', '==', roundId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as ScoreDoc)
      );
      setScores(docs);
    });

    return () => unsubscribe();
  }, [roundId]);

  return scores;
}
