'use client';
import { useState } from 'react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { setScore } from '../../lib/firestore';
import { validateScore } from '../../lib/scoreValidator';
import type { ScoreDoc, SyncStatus } from '../../types';

interface ScoreRowProps {
  roundId: string;
  chestNo: string;
  participantName: string;
  judgeId: string;
  isLocked: boolean;
  scoreMin?: number;
  scoreMax?: number;
  existingScore?: ScoreDoc;
}

export function ScoreRow({
  roundId,
  chestNo,
  participantName,
  judgeId,
  isLocked,
  scoreMin = 0,
  scoreMax = 10,
  existingScore,
}: ScoreRowProps) {
  const [inputValue, setInputValue] = useState<string>(
    existingScore?.score !== undefined ? String(existingScore.score) : ''
  );
  const [isAbsent, setIsAbsent] = useState<boolean>(existingScore?.absent ?? false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(
    existingScore ? 'synced' : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!isAbsent) {
      const parsed = parseFloat(inputValue);
      const validationError = validateScore(parsed, scoreMin, scoreMax);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
    }

    setSyncStatus('pending');

    try {
      await setScore({
        roundId,
        chestNo,
        judgeId,
        score: isAbsent ? 0 : parseFloat(inputValue),
        absent: isAbsent,
        submittedAt: new Date().toISOString(),
        synced: false,
      });
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save score');
    }
  };

  if (isLocked) {
    return (
      <div className="flex items-center gap-3 p-3 border-b border-gray-200">
        <span className="flex-1 text-sm text-gray-700">
          {chestNo} - {participantName}
        </span>
        <span className="text-sm font-medium text-gray-900">
          {existingScore?.absent ? 'Absent' : existingScore?.score ?? '—'}
        </span>
        <span className="text-sm text-gray-500">🔒 Locked</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-200">
      <span className="flex-1 text-sm text-gray-700">
        {chestNo} - {participantName}
      </span>

      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAbsent}
          onChange={(e) => setIsAbsent(e.target.checked)}
          className="w-4 h-4 accent-red-600"
        />
        Absent
      </label>

      <div className="flex flex-col gap-1">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          min={scoreMin}
          max={scoreMax}
          disabled={isAbsent}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:bg-gray-100"
          aria-label={`Score for ${participantName}`}
        />
        {errorMessage && (
          <span className="text-xs text-red-600">{errorMessage}</span>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="min-h-[48px] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Submit score for ${participantName}`}
      >
        Submit
      </button>

      {syncStatus !== null && <SyncStatusBadge syncStatus={syncStatus} />}
    </div>
  );
}