'use client';

import { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Same collection list ClearDataButton backs up — kept in sync manually
// since both files need to agree on what "all data" means.
const RESTORABLE_COLLECTIONS = [
  'participants',
  'events',
  'eventRounds',
  'judges',
  'scores',
  'podiums',
  'pointsConfig',
  'offStageJudgeAssignments',
  'chestNoPointsTotals',
] as const;

const FIRESTORE_BATCH_LIMIT = 500;

interface BackupFile {
  [collectionId: string]: Array<{ id: string; [field: string]: unknown }>;
}

function isValidBackup(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false;
  return RESTORABLE_COLLECTIONS.some((c) => Array.isArray((data as Record<string, unknown>)[c]));
}

export function RestoreBackupButton() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleRestore() {
    if (!file) return;
    setConfirming(false);
    setBusy(true);
    setError('');
    setLog([]);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!isValidBackup(data)) {
        throw new Error('This file does not look like a talent-test backup JSON.');
      }

      for (const collectionId of RESTORABLE_COLLECTIONS) {
        const records = data[collectionId];
        if (!Array.isArray(records) || records.length === 0) {
          addLog(`- ${collectionId}: nothing to restore`);
          continue;
        }

        let written = 0;
        for (let i = 0; i < records.length; i += FIRESTORE_BATCH_LIMIT) {
          const chunk = records.slice(i, i + FIRESTORE_BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((record) => {
            const { id, ...fields } = record;
            batch.set(doc(collection(db, collectionId), id), fields);
          });
          await batch.commit();
          written += chunk.length;
        }
        addLog(`✓ ${collectionId}: restored ${written} document(s)`);
      }

      addLog('');
      addLog('Restore complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Restores data from a backup JSON (the file auto-downloaded whenever you use Clear Data).
        This overwrites any existing documents with the same ID — it does not merge, and it does
        not remove documents that aren&apos;t in the backup. Use on a clean/empty database when
        possible.
      </p>

      <input
        type="file"
        accept="application/json"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={busy}
        className="text-sm"
      />

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-700 font-medium">
            Restore from &quot;{file?.name}&quot;? This will overwrite matching documents.
          </span>
          <button
            onClick={handleRestore}
            className="min-h-[40px] px-4 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition-colors"
          >
            Yes, restore
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="min-h-[40px] px-4 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          disabled={!file || busy}
          className="min-h-[48px] px-6 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-fit"
        >
          {busy ? 'Restoring…' : 'Restore From Backup'}
        </button>
      )}

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