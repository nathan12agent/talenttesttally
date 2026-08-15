'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ParticipantDoc } from '../types';

export function useParticipants(): ParticipantDoc[] {
  const [participants, setParticipants] = useState<ParticipantDoc[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'participants'), (snapshot) => {
      const docs = snapshot.docs.map(
        (doc) => ({ chestNo: doc.id, ...doc.data() } as ParticipantDoc)
      );
      setParticipants(docs);
    });

    return () => unsubscribe();
  }, []);

  return participants;
}
