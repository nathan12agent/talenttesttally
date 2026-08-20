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
  scoreMax = 100,
  existingScore,
}: ScoreRowProps) {
  const [value, setValue] = useState<number>(
    existingScore?.score !== undefined ? existingScore.score : scoreMin,
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(
    existingScore ? 'synced' : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clamp(n: number) {
    return Math.min(scoreMax, Math.max(scoreMin, n));
  }

  function decrement() {
    setValue((v) => clamp(v - 1));
  }

  function increment() {
    setValue((v) => clamp(v + 1));
  }

  const handleSubmit = async () => {
    setErrorMessage(null);

    const validationError = validateScore(value, scoreMin, scoreMax);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSyncStatus('pending');

    try {
      await setScore({
        roundId,
        chestNo,
        judgeId,
        score: value,
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
      <div className="flex items-center gap-3 p-4 border-b border-ink-muted/20">
        <div className="flex-1">
          <p className="text-xs text-ink-muted font-medium uppercase tracking-wider">{chestNo}</p>
          <p className="text-sm text-ink">{participantName}</p>
        </div>
        <span className="font-display text-2xl text-ink-muted">
          {existingScore?.score ?? '—'}
        </span>
        <span className="text-sm text-ink-muted">🔒 Locked</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 border-b border-ink-muted/20">
      {/* Participant info */}
      <div>
        <p className="text-xs text-ink-muted font-medium uppercase tracking-wider">{chestNo}</p>
        <p className="text-sm text-ink font-medium">{participantName}</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4 justify-center">
        <button
          onClick={decrement}
          disabled={value <= scoreMin}
          aria-label={`Decrease score for ${participantName}`}
          className="w-16 h-16 rounded-full bg-stage-charcoal text-ink text-2xl font-bold border border-ink-muted hover:border-spotlight-gold hover:text-spotlight-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-spotlight-gold"
        >
          −
        </button>
        <span
          className="font-display text-4xl text-paper w-16 text-center"
          aria-live="polite"
          aria-label={`Score: ${value}`}
        >
          {value}
        </span>
        <button
          onClick={increment}
          disabled={value >= scoreMax}
          aria-label={`Increase score for ${participantName}`}
          className="w-16 h-16 rounded-full bg-stage-charcoal text-ink text-2xl font-bold border border-ink-muted hover:border-spotlight-gold hover:text-spotlight-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-spotlight-gold"
        >
          +
        </button>
      </div>

      <p className="text-xs text-ink-muted text-center">
        Range: {scoreMin} – {scoreMax}
      </p>

      {errorMessage && (
        <p role="alert" className="text-curtain-red text-xs text-center">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-3 justify-between">
        <button
          onClick={handleSubmit}
          aria-label={`Submit score for ${participantName}`}
          className="flex-1 min-h-[52px] bg-spotlight-gold text-stage-black text-sm font-bold rounded-lg hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-spotlight-gold"
        >
          Submit
        </button>
        {syncStatus !== null && <SyncStatusBadge syncStatus={syncStatus} />}
      </div>
    </div>
  );
}
