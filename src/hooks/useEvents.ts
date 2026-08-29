'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EventDoc } from '../types';

export function useEvents(): EventDoc[] {
  const [events, setEvents] = useState<EventDoc[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        setEvents(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EventDoc)),
        );
      },
      (error) => {
        console.error('useEvents snapshot error:', error);
      },
    );

    return unsubscribe;
  }, []);

  return events;
}