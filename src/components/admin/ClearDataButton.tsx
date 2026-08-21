'use client';

import { useState } from 'react';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const CLEARABLE_COLLECTIONS = [
  { id: 'participants', label: 'Participants' },
  { id: 'events', label: 'Events' },
  { id: 'eventRounds', label: 'Rounds' },
  { id: 'judges', label: 'Judges' },
  { id: 'scores', label: 'Scores' },
  { id: 'podiums', label: 'Podium Results' },
  { id: 'pointsConfig', label: 'Points Config' },
  { id: 'offStageJudgeAssignments', label: 'Off-Stage Judge Assignments' },
  { id: 'chestNoPointsTotals', label: 'Points Totals' },
] as const;

type CollectionId = (typeof CLEARABLE_COLLECTIONS)[number]['id'];

const FIRESTORE_BATCH_LIMIT = 500;

/** Downloads a JSON snapshot of every clearable collection before deletion. */
async function exportBackup(): Promise<void> {
  const backup: Record<string, unknown[]> = {};

  for (const { id } of CLEARABLE_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, id));
    backup[id] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `talent-test-backup-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function clearCollection(collectionId: string): Promise<number> {
  const snapshot = await getDocs(collection(db, collectionId));
  const docs = snapshot.docs;
  let deleted = 0;

  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

export function ClearDataButton() {
  const [busyId, setBusyId] = useState<CollectionId | 'all' | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<CollectionId | 'all' | null>(null);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

    async function handleClearOne(id: CollectionId, label: string) {
    setConfirmId(null);
    setBusyId(id);
    setError('');
    try {
      await exportBackup();
      const count = await clearCollection(id);
      addLog(`✓ Backup downloaded. Cleared ${label}: ${count} document(s) deleted`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to clear ${label}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClearAll() {
    setConfirmId(null);
    setBusyId('all');
    setError('');
    setLog([]);
    try {
      await exportBackup();
      addLog('✓ Backup downloaded.');
      for (const { id, label } of CLEARABLE_COLLECTIONS) {
        const count = await clearCollection(id);
        addLog(`✓ Cleared ${label}: ${count} document(s) deleted`);
      }
      addLog('');
      addLog('All data cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear all data');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Permanently deletes data from Firestore. This cannot be undone — use before a fresh
        run, not while judges are actively scoring. A JSON backup of all data downloads
        automatically before anything is cleared.
      </p>

      <div className="flex items-center gap-3">
        {confirmId === 'all' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-700 font-medium">Delete ALL data for every collection?</span>
            <button
              onClick={handleClearAll}
              className="min-h-[40px] px-4 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition-colors"
            >
              Yes, clear everything
            </button>
            <button
              onClick={() => setConfirmId(null)}
              className="min-h-[40px] px-4 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmId('all')}
            disabled={busyId !== null}
            className="min-h-[48px] px-6 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busyId === 'all' ? 'Clearing everything…' : 'Clear All Data'}
          </button>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Or clear individually</p>
        <div className="flex flex-wrap gap-2">
          {CLEARABLE_COLLECTIONS.map(({ id, label }) =>
            confirmId === id ? (
              <div key={id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                <span className="text-xs text-red-700">Delete {label}?</span>
                <button
                  onClick={() => handleClearOne(id, label)}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                key={id}
                onClick={() => setConfirmId(id)}
                disabled={busyId !== null}
                className="min-h-[40px] px-3 bg-white border border-red-300 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busyId === id ? 'Clearing…' : `Clear ${label}`}
              </button>
            ),
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-700 space-y-0.5 max-h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}