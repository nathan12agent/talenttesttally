'use client';

import { useState } from 'react';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * One-click seed button for development / first-run setup.
 * Writes 3 judges, 3 events, 3 rounds, and 5 participants to Firestore
 * using the client SDK (requires admin session to be active so rules allow writes).
 */
export function SeedButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleSeed() {
    setStatus('running');
    setLog([]);
    setError('');

    try {
      // ── Judges ──────────────────────────────────────────────────────────
      const judgeData = [
        { name: 'Judge Alice', pin: '1001', deviceLinkToken: 'token-alice' },
        { name: 'Judge Bob',   pin: '1002', deviceLinkToken: 'token-bob'   },
        { name: 'Judge Carol', pin: '1003', deviceLinkToken: 'token-carol' },
      ];

      const judgeIds: string[] = [];
      for (const j of judgeData) {
        const ref = await addDoc(collection(db, 'judges'), j);
        judgeIds.push(ref.id);
        addLog(`✓ Judge: ${j.name} (PIN: ${j.pin})`);
      }

      // ── Events ───────────────────────────────────────────────────────────
      const eventData = [
        { name: 'Solo Singing',       location: 'onstage',  scoringMode: 'averaged'     },
        { name: 'Group Dance',        location: 'onstage',  scoringMode: 'averaged'     },
        { name: 'Solo Instrumental',  location: 'offstage', scoringMode: 'singleByGroup'},
      ];

      const eventIds: string[] = [];
      for (const e of eventData) {
        const ref = await addDoc(collection(db, 'events'), e);
        eventIds.push(ref.id);
        addLog(`✓ Event: ${e.name}`);
      }

      // ── Rounds ───────────────────────────────────────────────────────────
      for (let i = 0; i < eventIds.length; i++) {
        const isOffstage = eventData[i].location === 'offstage';
        await addDoc(collection(db, 'eventRounds'), {
          eventId: eventIds[i],
          group: 'Sub Jr',
          scoringType: isOffstage ? 'single' : 'averaged',
          batchMode: isOffstage,
          assignedJudgeIds: isOffstage ? [judgeIds[0]] : judgeIds,
          participantChestNos: ['1', '2', '3'],
          scheduledOrder: i + 1,
          status: 'pending',
          scoreMin: 0,
          scoreMax: 100,
        });
        addLog(`✓ Round for ${eventData[i].name}`);
      }

      // ── Participants ─────────────────────────────────────────────────────
      const participants = [
        { chestNo: '1', name: 'Alice Smith',  group: 'Sub Jr'       },
        { chestNo: '2', name: 'Bob Jones',    group: 'Sub Jr'       },
        { chestNo: '3', name: 'Carol White',  group: 'Sub Jr'       },
        { chestNo: '4', name: 'David Brown',  group: 'Jr'           },
        { chestNo: '5', name: 'Eva Green',    group: 'Intermediate' },
      ];

      for (const p of participants) {
        await setDoc(doc(db, 'participants', p.chestNo), p);
        addLog(`✓ Participant: ${p.name} (#${p.chestNo})`);
      }

      addLog('');
      addLog('Seed complete! Judge PINs: 1001, 1002, 1003');
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Populates Firestore with 3 judges (PINs: <code>1001</code>, <code>1002</code>, <code>1003</code>),
        3 sample events, 3 rounds, and 5 participants. Safe to run once on a fresh database.
      </p>

      <button
        onClick={handleSeed}
        disabled={status === 'running' || status === 'done'}
        className="min-h-[48px] px-6 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed self-start transition-colors"
      >
        {status === 'running' ? 'Seeding…' : status === 'done' ? '✓ Seeded' : 'Seed Sample Data'}
      </button>

      {log.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-700 space-y-0.5 max-h-48 overflow-y-auto">
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
}
