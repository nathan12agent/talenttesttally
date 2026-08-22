'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useParticipants } from '../../hooks/useParticipants';
import { useScores } from '../../hooks/useScores';
import { ConnectivityBanner } from '../shared/ConnectivityBanner';
import { ChestBadge } from '../shared/ChestBadge';
import { ScoreRow } from './ScoreRow';
import type { ParticipantDoc, RoundDoc } from '../../types';

interface ScoreSheetProps {
  round: RoundDoc;
  judgeId: string;
  onBack: () => void;
}

export function ScoreSheet({ round, judgeId, onBack }: ScoreSheetProps) {
  const [eventName, setEventName] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const participants: ParticipantDoc[] = allParticipants
    .filter((p) => round.participantChestNos.includes(p.chestNo))
    .sort((a, b) => Number(a.chestNo) - Number(b.chestNo));

  const isLocked = round.status === 'locked';
  const scoreMin = round.scoreMin ?? 0;
  const scoreMax = round.scoreMax ?? 10;

  const title = eventName ? `${eventName}` : round.id;

  const header = (
    <>
      <ConnectivityBanner />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-spotlight-gold hover:opacity-80 mb-4 focus:outline-none focus:ring-2 focus:ring-spotlight-gold rounded"
          aria-label="Back to round list"
        >
          ← Back
        </button>

        <h1 className="font-display text-4xl text-ink tracking-wide leading-tight">
          {title}
        </h1>
        <p className="font-display text-xl text-spotlight-gold tracking-widest mt-0.5">
          {round.group}
        </p>

        {round.batchMode && (
          <p className="text-xs text-ink-muted mt-1">Batch mode — score in any order</p>
        )}

        {isLocked && (
          <div
            className="mt-3 mb-1 px-4 py-3 rounded-lg bg-stage-charcoal border border-ink-muted/30 text-ink-muted text-sm font-medium"
            role="alert"
          >
            🔒 Scores are final — this round is locked
          </div>
        )}
      </div>
    </>
  );

  // ── Batch mode ──────────────────────────────────────────────────────────────
  if (round.batchMode) {
    return (
      <div className="min-h-screen bg-stage-black">
        {header}
        <div className="max-w-lg mx-auto px-4 pb-8">
          <div className="bg-stage-charcoal rounded-xl overflow-hidden shadow-lg">
            {participants.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">No participants in this round.</p>
            ) : (
              participants.map((p) => {
                const existingScore = scores.find(
                  (s) => s.roundId === round.id && s.chestNo === p.chestNo && s.judgeId === judgeId,
                );
                return (
                  <div key={p.chestNo}>
                    <div className="flex items-center gap-3 px-4 pt-4">
                      <ChestBadge
                        chestNo={p.chestNo}
                        size="md"
                        pulse={syncStatus_for(p.chestNo, scores, judgeId)}
                      />
                      <span className="text-ink font-medium text-sm">{p.name}</span>
                    </div>
                    <ScoreRow
                      roundId={round.id}
                      chestNo={p.chestNo}
                      participantName={p.name}
                      judgeId={judgeId}
                      isLocked={isLocked}
                      scoreMin={scoreMin}
                      scoreMax={scoreMax}
                      existingScore={existingScore}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Sequential mode ─────────────────────────────────────────────────────────
  const safeIndex = Math.min(currentIndex, Math.max(0, participants.length - 1));
  const currentParticipant = participants[safeIndex] ?? null;

  return (
    <div className="min-h-screen bg-stage-black">
      {header}
      <div className="max-w-lg mx-auto px-4 pb-8">
        {participants.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">No participants in this round.</p>
        ) : (
          <>
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={safeIndex === 0}
                className="min-h-[48px] px-4 text-sm font-medium text-spotlight-gold disabled:text-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-spotlight-gold rounded"
              >
                ← Prev
              </button>
              <span className="text-sm text-ink-muted">
                {safeIndex + 1} / {participants.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(participants.length - 1, i + 1))}
                disabled={safeIndex === participants.length - 1}
                className="min-h-[48px] px-4 text-sm font-medium text-spotlight-gold disabled:text-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-spotlight-gold rounded"
              >
                Next →
              </button>
            </div>

            {/* Current participant */}
            {currentParticipant && (
              <div className="bg-stage-charcoal rounded-xl overflow-hidden shadow-lg">
                {/* Chest badge centered */}
                <div className="flex flex-col items-center pt-6 pb-2 gap-2">
                  <ChestBadge
                    chestNo={currentParticipant.chestNo}
                    size="lg"
                    pulse={false}
                  />
                  <p className="text-ink font-medium text-base mt-1">
                    {currentParticipant.name}
                  </p>
                </div>

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

/** Returns true if the judge already submitted for this chest (used for pulse trigger) */
function syncStatus_for(
  chestNo: string,
  scores: ReturnType<typeof useScores>,
  judgeId: string,
): boolean {
  return scores.some((s) => s.chestNo === chestNo && s.judgeId === judgeId);
}
