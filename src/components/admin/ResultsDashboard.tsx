'use client';

import { useState, useEffect } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { useParticipants } from '../../hooks/useParticipants';
import { useScores } from '../../hooks/useScores';
import { computeRoundScore, computeCumulativeTotal } from '../../lib/scoring';
import type { Group, EventDoc, JudgeDoc, RoundDoc, ParticipantDoc, ScoreDoc } from '../../types';

// ─── ResultsDashboard props ───────────────────────────────────────────────────

interface ResultsDashboardProps {
  group: Group | 'all';
  events: EventDoc[];
  judges: JudgeDoc[];
}

// ─── RoundScoreTable ──────────────────────────────────────────────────────────
// Inner component so it can call useScores per round (Rules of Hooks)

interface RoundScoreTableProps {
  round: RoundDoc;
  participants: ParticipantDoc[];
  events: EventDoc[];
  judges: JudgeDoc[];
}

function RoundScoreTable({ round, participants, events, judges }: RoundScoreTableProps) {
  const scores = useScores(round.id);

  const event = events.find((e) => e.id === round.eventId);
  const eventName = event?.name ?? round.eventId;

  // Judges assigned to this round, in stable order
  const roundJudges = judges.filter((j) => round.assignedJudgeIds.includes(j.id));

  // Participants that belong to this round, sorted by chest number
  const roundParticipants = participants
    .filter((p) => round.participantChestNos.includes(p.chestNo))
    .sort((a, b) => Number(a.chestNo) - Number(b.chestNo));

  // Distinct judge IDs that have submitted at least one score for this round
  const submittedJudgeIds = new Set(scores.map((s) => s.judgeId));
  const submitted = submittedJudgeIds.size;
  const expected = round.assignedJudgeIds.length;

  return (
    <div className="mb-8">
      {/* Round heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          {eventName} — {round.group}
        </h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            round.status === 'locked'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {round.status === 'locked' ? '🔒 Locked' : '● Live'}
        </span>
      </div>

      {/* Submission count */}
      <p className="text-sm text-gray-500 mb-3">
        {submitted} of {expected} judge{expected !== 1 ? 's' : ''} submitted
      </p>

      {/* Score table — horizontally scrollable on small screens */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                Chest No
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
              {roundJudges.map((judge) => (
                <th
                  key={judge.id}
                  className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap"
                >
                  {judge.name}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-gray-100">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roundParticipants.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + roundJudges.length + 1}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  No participants in this round.
                </td>
              </tr>
            ) : (
              roundParticipants.map((participant) => {
                const judgeScores = roundJudges.map((judge) => {
                  const scoreDoc = scores.find(
                    (s) => s.chestNo === participant.chestNo && s.judgeId === judge.id,
                  );
                  return scoreDoc?.score ?? null;
                });

                const submittedScores = judgeScores.filter((s): s is number => s !== null);
                const finalScore = computeRoundScore(submittedScores, round.scoringType);

                return (
                  <tr key={participant.chestNo} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">
                      {participant.chestNo}
                    </td>
                    <td className="px-3 py-2 text-gray-800">{participant.name}</td>
                    {judgeScores.map((score, idx) => (
                      <td
                        key={roundJudges[idx].id}
                        className="px-3 py-2 text-center text-gray-700"
                      >
                        {score !== null ? (
                          score.toFixed(1)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-gray-800 bg-gray-50 whitespace-nowrap">
                      {submittedScores.length > 0 ? (
                        finalScore.toFixed(2)
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LockedRoundScoreCollector ────────────────────────────────────────────────
// Renders nothing visible; calls useScores for one locked round and propagates
// updates to the parent via a stable callback.

interface LockedRoundScoreCollectorProps {
  roundId: string;
  onScoresUpdate: (roundId: string, scores: ScoreDoc[]) => void;
}

function LockedRoundScoreCollector({
  roundId,
  onScoresUpdate,
}: LockedRoundScoreCollectorProps) {
  const scores = useScores(roundId);

  useEffect(() => {
    onScoresUpdate(roundId, scores);
  }, [roundId, scores, onScoresUpdate]);

  return null;
}

// ─── CumulativeTotalsSection ──────────────────────────────────────────────────
// Renders one LockedRoundScoreCollector per locked round (each calls useScores),
// accumulates all scores in state, then renders the totals table.

interface CumulativeTotalsSectionProps {
  lockedRounds: RoundDoc[];
  participants: ParticipantDoc[];
  judges: JudgeDoc[];
}

function CumulativeTotalsSection({
  lockedRounds,
  participants,
  judges,
}: CumulativeTotalsSectionProps) {
  // Map of roundId → ScoreDoc[] — updated by LockedRoundScoreCollector children
  const [roundScoresMap, setRoundScoresMap] = useState<Record<string, ScoreDoc[]>>({});

  // Stable callback so child useEffects don't loop
  const handleScoresUpdate = (roundId: string, scores: ScoreDoc[]) => {
    setRoundScoresMap((prev) => {
      // Avoid unnecessary re-renders when scores haven't changed
      if (prev[roundId] === scores) return prev;
      return { ...prev, [roundId]: scores };
    });
  };

  // Compute cumulative total per participant across all locked rounds
  const totals = participants.map((participant) => {
    const perRoundScores = lockedRounds.map((round) => {
      const scores = roundScoresMap[round.id] ?? [];
      const roundJudges = judges.filter((j) => round.assignedJudgeIds.includes(j.id));
      const submittedScores = roundJudges
        .map(
          (judge) =>
            scores.find(
              (s) => s.chestNo === participant.chestNo && s.judgeId === judge.id,
            )?.score,
        )
        .filter((s): s is number => s !== undefined);
      return computeRoundScore(submittedScores, round.scoringType);
    });
    return {
      participant,
      total: computeCumulativeTotal(perRoundScores),
    };
  });

  // Sort by total descending
  const sorted = [...totals].sort((a, b) => b.total - a.total);

  return (
    <>
      {/* Hidden score collectors — one per locked round */}
      {lockedRounds.map((round) => (
        <LockedRoundScoreCollector
          key={round.id}
          roundId={round.id}
          onScoresUpdate={handleScoresUpdate}
        />
      ))}

      {/* Totals table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                Rank
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                Chest No
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Group</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-gray-100">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  No results yet.
                </td>
              </tr>
            ) : (
              sorted.map(({ participant, total }, idx) => (
                <tr key={participant.chestNo} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 font-medium">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{participant.chestNo}</td>
                  <td className="px-3 py-2 text-gray-800">{participant.name}</td>
                  <td className="px-3 py-2 text-gray-600">{participant.group}</td>
                  <td className="px-3 py-2 text-center font-bold text-gray-900 bg-gray-50">
                    {total.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── ResultsDashboard (main export) ──────────────────────────────────────────

export function ResultsDashboard({ group, events, judges }: ResultsDashboardProps) {
  const allRounds = useRounds();
  const allParticipants = useParticipants();

  // Filter to live/locked rounds, optionally narrowed by group
  const activeRounds = allRounds.filter(
    (r) =>
      (r.status === 'live' || r.status === 'locked') &&
      (group === 'all' || r.group === group),
  );

  // Filter participants to selected group
  const participants = allParticipants.filter(
    (p) => group === 'all' || p.group === group,
  );

  // Only locked rounds contribute to cumulative totals
  const lockedRounds = activeRounds.filter((r) => r.status === 'locked');

  if (activeRounds.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 text-base">
        No live or locked rounds yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Per-round score tables */}
      {activeRounds.map((round) => (
        <RoundScoreTable
          key={round.id}
          round={round}
          participants={participants}
          events={events}
          judges={judges}
        />
      ))}

      {/* Cumulative totals — only when at least one round is locked */}
      {lockedRounds.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Cumulative Totals
          </h3>
          <CumulativeTotalsSection
            lockedRounds={lockedRounds}
            participants={participants}
            judges={judges}
          />
        </div>
      )}
    </div>
  );
}
