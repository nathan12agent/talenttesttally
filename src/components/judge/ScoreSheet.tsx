'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useParticipants } from '../../hooks/useParticipants';
import { useScores } from '../../hooks/useScores';
import { getTeamsForRound } from '../../lib/firestore';
import { ConnectivityBanner } from '../shared/ConnectivityBanner';
import { ChestBadge } from '../shared/ChestBadge';
import { ScoreRow } from './ScoreRow';
import type { RoundDoc, TeamDoc } from '../../types';

interface ScoreSheetProps {
  round: RoundDoc;
  judgeId: string;
  onBack: () => void;
}

// A unified shape so team events and normal events can render through the
// exact same list/UI below — id is either a real chestNo or a teamId,
// label is what's shown on screen.
interface ScoreEntry {
  id: string;
  label: string;
}

export function ScoreSheet({ round, judgeId, onBack }: ScoreSheetProps) {
  const [eventName, setEventName] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [teams, setTeams] = useState<TeamDoc[]>([]);

  useEffect(() => {
    if (!round.eventId) return;
    getDoc(doc(db, 'events', round.eventId)).then((snap) => {
      if (snap.exists()) {
        setEventName((snap.data() as { name: string }).name);
      }
    });
  }, [round.eventId]);

  // Team events store teamIds in participantChestNos instead of real chest
  // numbers — fetch the team docs so we can show team names, not raw IDs.
  useEffect(() => {
    if (!round.isTeamEvent) {
      setTeams([]);
      return;
    }
    getTeamsForRound(round.id).then(setTeams);
  }, [round.id, round.isTeamEvent]);

  const allParticipants = useParticipants();
  const scores = useScores(round.id);

  const entries: ScoreEntry[] = round.isTeamEvent
    ? teams
        .filter((t) => round.participantChestNos.includes(t.id))
        .map((t) => ({ id: t.id, label: t.name }))
    : allParticipants
        .filter((p) => round.participantChestNos.includes(p.chestNo))
        .sort((a, b) => Number(a.chestNo) - Number(b.chestNo))
        .map((p) => ({ id: p.chestNo, label: p.name }));

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
            {entries.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">No participants in this round.</p>
            ) : (
              entries.map((entry) => {
                const existingScore = scores.find(
                  (s) => s.roundId === round.id && s.chestNo === entry.id && s.judgeId === judgeId,
                );
                return (
                  <div key={entry.id}>
                    <div className="flex items-center gap-3 px-4 pt-4">
                      {!round.isTeamEvent && (
                        <ChestBadge
                          chestNo={entry.id}
                          size="md"
                          pulse={syncStatus_for(entry.id, scores, judgeId)}
                        />
                      )}
                      <span className="text-ink font-medium text-sm">
                        {round.isTeamEvent ? `👥 ${entry.label}` : entry.label}
                      </span>
                    </div>
                    <ScoreRow
                      roundId={round.id}
                      chestNo={entry.id}
                      participantName={entry.label}
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
  const safeIndex = Math.min(currentIndex, Math.max(0, entries.length - 1));
  const currentEntry = entries[safeIndex] ?? null;

  return (
    <div className="min-h-screen bg-stage-black">
      {header}
      <div className="max-w-lg mx-auto px-4 pb-8">
        {entries.length === 0 ? (
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
                {safeIndex + 1} / {entries.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(entries.length - 1, i + 1))}
                disabled={safeIndex === entries.length - 1}
                className="min-h-[48px] px-4 text-sm font-medium text-spotlight-gold disabled:text-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-spotlight-gold rounded"
              >
                Next →
              </button>
            </div>

            {/* Current entry */}
            {currentEntry && (
              <div className="bg-stage-charcoal rounded-xl overflow-hidden shadow-lg">
                <div className="flex flex-col items-center pt-6 pb-2 gap-2">
                  {round.isTeamEvent ? (
                    <span className="text-3xl">👥</span>
                  ) : (
                    <ChestBadge chestNo={currentEntry.id} size="lg" pulse={false} />
                  )}
                  <p className="text-ink font-medium text-base mt-1">
                    {currentEntry.label}
                  </p>
                </div>

                <ScoreRow
                  key={currentEntry.id}
                  roundId={round.id}
                  chestNo={currentEntry.id}
                  participantName={currentEntry.label}
                  judgeId={judgeId}
                  isLocked={isLocked}
                  scoreMin={scoreMin}
                  scoreMax={scoreMax}
                  existingScore={scores.find(
                    (s) =>
                      s.roundId === round.id &&
                      s.chestNo === currentEntry.id &&
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

/** Returns true if the judge already submitted for this entry (used for pulse trigger) */
function syncStatus_for(
  entryId: string,
  scores: ReturnType<typeof useScores>,
  judgeId: string,
): boolean {
  return scores.some((s) => s.chestNo === entryId && s.judgeId === judgeId);
}