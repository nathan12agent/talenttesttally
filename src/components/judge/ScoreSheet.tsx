'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useParticipants } from '../../hooks/useParticipants';
import { useScores } from '../../hooks/useScores';
import { ConnectivityBanner } from '../shared/ConnectivityBanner';
import { ScoreRow } from './ScoreRow';
import type { ParticipantDoc, RoundDoc } from '../../types';

interface ScoreSheetProps {
  round: RoundDoc;
  judgeId: string;
  onBack: () => void;
}

export function ScoreSheet({ round, judgeId, onBack }: ScoreSheetProps) {
  const [eventName, setEventName] = useState<string | null>(null);
  // For sequential (on-stage) mode: track which participant is "current"
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch the event name from Firestore once on mount / when eventId changes
  useEffect(() => {
    if (!round.eventId) return;
    getDoc(doc(db, 'events', round.eventId)).then((snap) => {
      if (snap.exists()) {
        setEventName((snap.data() as { name: string }).name);
      }
    });
  }, [round.eventId]);

  const allParticipants = useParticipants();
  const scores = useScores(round.id);

  // Filter to participants in this round, sorted by chestNo
  const participants: ParticipantDoc[] = allParticipants
    .filter((p) => round.participantChestNos.includes(p.chestNo))
    .sort((a, b) => Number(a.chestNo) - Number(b.chestNo));

  const isLocked = round.status === 'locked';
  const scoreMin = round.scoreMin ?? 0;
  const scoreMax = round.scoreMax ?? 100;

  // Build the title: "Solo Singing — Sub Jr" or fall back to round.id
  const title = eventName ? `${eventName} — ${round.group}` : round.id;

  const header = (
    <>
      <ConnectivityBanner />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label="Back to round list"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{title}</h1>
        {round.batchMode && (
          <p className="text-xs text-purple-600 mb-1">Batch mode — score in any order</p>
        )}
        {isLocked && (
          <div
            className="mb-4 px-4 py-3 rounded bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm font-medium"
            role="alert"
          >
            🔒 Scores are final — this round is locked
          </div>
        )}
      </div>
    </>
  );

  // ── Batch mode (off-stage): show all participants at once ───────────────────
  if (round.batchMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {header}
        <div className="max-w-lg mx-auto px-4 pb-8">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {participants.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No participants in this round.</p>
            ) : (
              participants.map((p) => {
                const existingScore = scores.find(
                  (s) => s.roundId === round.id && s.chestNo === p.chestNo && s.judgeId === judgeId,
                );
                return (
                  <ScoreRow
                    key={p.chestNo}
                    roundId={round.id}
                    chestNo={p.chestNo}
                    participantName={p.name}
                    judgeId={judgeId}
                    isLocked={isLocked}
                    scoreMin={scoreMin}
                    scoreMax={scoreMax}
                    existingScore={existingScore}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Sequential mode (on-stage): one participant at a time ──────────────────
  const safeIndex = Math.min(currentIndex, Math.max(0, participants.length - 1));
  const currentParticipant = participants[safeIndex] ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {header}
      <div className="max-w-lg mx-auto px-4 pb-8">
        {participants.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No participants in this round.</p>
        ) : (
          <>
            {/* Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={safeIndex === 0}
                className="min-h-[48px] px-4 text-sm font-medium text-blue-600 disabled:text-gray-300 focus:outline-none"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">
                {safeIndex + 1} / {participants.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(participants.length - 1, i + 1))}
                disabled={safeIndex === participants.length - 1}
                className="min-h-[48px] px-4 text-sm font-medium text-blue-600 disabled:text-gray-300 focus:outline-none"
              >
                Next →
              </button>
            </div>

            {/* Current participant score row */}
            {currentParticipant && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <ScoreRow
                  key={currentParticipant.chestNo}
                  roundId={round.id}
                  chestNo={currentParticipant.chestNo}
                  participantName={currentParticipant.name}
                  judgeId={judgeId}
                  isLocked={isLocked}
                  scoreMin={scoreMin}
                  scoreMax={scoreMax}
                  existingScore={scores.find(
                    (s) =>
                      s.roundId === round.id &&
                      s.chestNo === currentParticipant.chestNo &&
                      s.judgeId === judgeId,
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}