'use client';
import { useState, useMemo } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { ScoreSheet } from './ScoreSheet';
import type { Group, RoundDoc } from '../../types';

interface RoundListProps {
  judgeId: string;
  judgeName: string;
  onLogout: () => void;
}

const ALL_GROUPS = 'all' as const;

export function RoundList({ judgeId, judgeName, onLogout }: RoundListProps) {
  const rounds = useRounds(judgeId);
  const [selectedRound, setSelectedRound] = useState<RoundDoc | null>(null);
  const [groupFilter, setGroupFilter] = useState<Group | typeof ALL_GROUPS>(ALL_GROUPS);

  const availableGroups = useMemo<Group[]>(() => {
    const seen = new Set<Group>();
    rounds.forEach((r) => seen.add(r.group));
    return Array.from(seen).sort();
  }, [rounds]);

  const hasBatchMultiGroup =
    rounds.some((r) => r.batchMode) && availableGroups.length > 1;

  const filteredRounds =
    groupFilter === ALL_GROUPS
      ? rounds
      : rounds.filter((r) => r.group === groupFilter);

  if (selectedRound) {
    return (
      <ScoreSheet
        round={selectedRound}
        judgeId={judgeId}
        onBack={() => setSelectedRound(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stage-black">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-8">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="font-display text-5xl text-spotlight-gold tracking-wide">
            Welcome,<br />
            <span className="text-ink">{judgeName}</span>
          </h1>
          <button
            onClick={onLogout}
            className="min-h-[40px] px-4 mt-2 text-sm font-medium text-ink-muted border border-ink-muted/30 rounded-lg hover:text-ink hover:border-ink-muted/60 transition-colors flex-shrink-0"
          >
            Logout
          </button>
        </div>

        {/* Group filter pills */}
        {hasBatchMultiGroup && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setGroupFilter(ALL_GROUPS)}
              className={`min-h-[40px] px-4 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-spotlight-gold ${
                groupFilter === ALL_GROUPS
                  ? 'bg-spotlight-gold text-stage-black border-spotlight-gold'
                  : 'bg-transparent text-ink-muted border-ink-muted/40 hover:border-spotlight-gold hover:text-ink'
              }`}
            >
              All groups
            </button>
            {availableGroups.map((g) => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`min-h-[40px] px-4 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-spotlight-gold ${
                  groupFilter === g
                    ? 'bg-spotlight-gold text-stage-black border-spotlight-gold'
                    : 'bg-transparent text-ink-muted border-ink-muted/40 hover:border-spotlight-gold hover:text-ink'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* No rounds */}
        {filteredRounds.length === 0 ? (
          <p className="text-sm text-ink-muted text-center mt-16">
            No rounds are currently live. Please wait for the admin to start a round.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRounds.map((round) => {
              const isOnStage = !round.batchMode;
              return (
                <div
                  key={round.id}
                  className={`bg-stage-charcoal rounded-xl p-4 flex flex-col gap-3 border-l-4 ${
                    isOnStage ? 'border-spotlight-gold' : 'border-curtain-red'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">
                      {isOnStage ? '🎯' : '📋'}
                    </span>
                    <p className="text-base font-semibold text-ink">
                      {round.group}
                    </p>
                    {round.batchMode && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-curtain-red/20 text-curtain-red border border-curtain-red/30">
                        Batch
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-muted">
                    {round.participantChestNos.length} participant
                    {round.participantChestNos.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => setSelectedRound(round)}
                    className="w-full min-h-[56px] bg-spotlight-gold text-stage-black text-sm font-bold rounded-lg hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-spotlight-gold focus:ring-offset-2 focus:ring-offset-stage-charcoal"
                  >
                    Score This Round →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}