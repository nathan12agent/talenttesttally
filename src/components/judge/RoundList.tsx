'use client';
import { useState, useMemo } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { ScoreSheet } from './ScoreSheet';
import type { Group, RoundDoc } from '../../types';

interface RoundListProps {
  judgeId: string;
  judgeName: string;
}

const ALL_GROUPS = 'all' as const;

export function RoundList({ judgeId, judgeName }: RoundListProps) {
  const rounds = useRounds(judgeId);
  const [selectedRound, setSelectedRound] = useState<RoundDoc | null>(null);
  const [groupFilter, setGroupFilter] = useState<Group | typeof ALL_GROUPS>(ALL_GROUPS);

  // Collect distinct groups that have at least one round
  const availableGroups = useMemo<Group[]>(() => {
    const seen = new Set<Group>();
    rounds.forEach((r) => seen.add(r.group));
    return Array.from(seen).sort();
  }, [rounds]);

  // Determine whether to show a group switcher:
  // show when there are batch-mode (off-stage) rounds in multiple groups
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
        {/* Greeting */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Welcome, {judgeName}
        </h1>

        {/* Group filter — only shown when off-stage judge covers multiple groups */}
        {hasBatchMultiGroup && (
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => setGroupFilter(ALL_GROUPS)}
              className={`min-h-[40px] px-3 rounded-full text-sm font-medium border transition-colors ${
                groupFilter === ALL_GROUPS
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              All groups
            </button>
            {availableGroups.map((g) => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`min-h-[40px] px-3 rounded-full text-sm font-medium border transition-colors ${
                  groupFilter === g
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* No live rounds */}
        {filteredRounds.length === 0 ? (
          <p className="text-sm text-gray-500 text-center mt-12">
            No rounds are currently live. Please wait for the admin to start a round.
          </p>
        ) : (
          <div>
            {filteredRounds.map((round) => (
              <div
                key={round.id}
                className="bg-white rounded-lg shadow-sm p-4 mb-3 border border-gray-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-medium text-gray-900">
                    {round.group}
                  </p>
                  {round.batchMode && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      Batch
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {round.participantChestNos.length} participants
                </p>
                <button
                  onClick={() => setSelectedRound(round)}
                  className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Score This Round →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
