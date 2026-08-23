'use client';

import { useState, useEffect } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { useParticipants } from '../../hooks/useParticipants';
import { useScores } from '../../hooks/useScores';
import { computeRoundScore } from '../../lib/scoring';
import { ChestBadge } from '../shared/ChestBadge';
import type { Group, EventDoc, JudgeDoc, RoundDoc, ParticipantDoc } from '../../types';

interface ResultsDashboardProps {
  group: Group | 'all';
  events: EventDoc[];
  judges: JudgeDoc[];
}

// ─── Podium ───────────────────────────────────────────────────────────────────

interface PodiumParticipant {
  chestNo: string;
  name: string;
  score: number;
  rank: 1 | 2 | 3;
}

const PODIUM_HEIGHT: Record<1 | 2 | 3, string> = {
  1: 'h-28',
  2: 'h-20',
  3: 'h-14',
};

const PODIUM_COLOR: Record<1 | 2 | 3, string> = {
  1: 'bg-podium-gold',
  2: 'bg-podium-silver',
  3: 'bg-podium-bronze',
};

const PODIUM_LABEL: Record<1 | 2 | 3, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
};

function PodiumView({ top3 }: { top3: PodiumParticipant[] }) {
  // Reorder to: 2nd, 1st, 3rd for visual podium layout
  const order: Array<1 | 2 | 3> = [2, 1, 3];
  const byRank = Object.fromEntries(top3.map((p) => [p.rank, p])) as Record<1 | 2 | 3, PodiumParticipant | undefined>;

  return (
    <div className="rounded-xl bg-stage-charcoal border border-ink-muted/10 p-6 mb-6">
      <h3 className="font-display text-2xl text-spotlight-gold tracking-wide mb-6 text-center">
        Podium
      </h3>
      <div className="flex items-end justify-center gap-3">
        {order.map((rank) => {
          const participant = byRank[rank];
          if (!participant) return null;
          return (
            <div key={rank} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
              {/* Chest badge above column */}
              <ChestBadge chestNo={participant.chestNo} size="md" isPodium rank={rank} />
              <p className="text-xs text-ink font-medium text-center truncate w-full px-1">
                {participant.name}
              </p>
              <p className="font-display text-xl text-spotlight-gold">
                {participant.score.toFixed(2)}
              </p>
              {/* Podium column */}
              <div
                className={`w-full rounded-t-md ${PODIUM_COLOR[rank]} ${PODIUM_HEIGHT[rank]} flex items-center justify-center`}
              >
                <span className="font-display text-stage-black text-lg">{PODIUM_LABEL[rank]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RoundScoreTable ──────────────────────────────────────────────────────────

interface RoundScoreTableProps {
  round: RoundDoc;
  participants: ParticipantDoc[];
  events: EventDoc[];
  judges: JudgeDoc[];
}

function RoundScoreTable({ round, participants, events, judges }: RoundScoreTableProps) {
  const scores = useScores(round.id);
  const [teams, setTeams] = useState<import('../../types').TeamDoc[]>([]);

  useEffect(() => {
    if (!round.isTeamEvent) return;
    import('../../lib/firestore').then(({ getTeamsForRound }) => {
      getTeamsForRound(round.id).then(setTeams);
    });
  }, [round.id, round.isTeamEvent]);

  const event = events.find((e) => e.id === round.eventId);
  const eventName = event?.name ?? round.eventId;

  const roundJudges = judges.filter((j) => round.assignedJudgeIds.includes(j.id));

  // Unified row shape: id + label, works for both real chest numbers and team IDs
  const rows: { id: string; label: string }[] = round.isTeamEvent
    ? teams
        .filter((t) => round.participantChestNos.includes(t.id))
        .map((t) => ({ id: t.id, label: `👥 ${t.name}` }))
    : participants
        .filter((p) => round.participantChestNos.includes(p.chestNo))
        .sort((a, b) => Number(a.chestNo) - Number(b.chestNo))
        .map((p) => ({ id: p.chestNo, label: p.name }));

  const submittedJudgeIds = new Set(scores.map((s) => s.judgeId));
  const submitted = submittedJudgeIds.size;
  const expected = round.assignedJudgeIds.length;

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
        <h3 className="font-display text-xl text-ink tracking-wide">
          {eventName} — {round.group}
        </h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            round.status === 'locked'
              ? 'bg-ink-muted/10 text-ink-muted'
              : 'bg-spotlight-gold/20 text-spotlight-gold'
          }`}
        >
          {round.status === 'locked' ? '🔒 Locked' : '● Live'}
        </span>
      </div>

      <p className="text-xs text-ink-muted mb-3">
        {submitted} of {expected} judge{expected !== 1 ? 's' : ''} submitted
      </p>

      <div className="overflow-x-auto rounded-lg border border-ink-muted/10">
        <table className="min-w-full text-sm">
          <thead className="bg-stage-charcoal border-b border-ink-muted/10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-muted text-xs uppercase tracking-wider">
                {round.isTeamEvent ? 'Team' : 'Name'}
              </th>
              {roundJudges.map((judge) => (
                <th
                  key={judge.id}
                  className="px-3 py-2 text-center font-medium text-ink-muted whitespace-nowrap text-xs uppercase tracking-wider"
                >
                  {judge.name}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-spotlight-gold whitespace-nowrap bg-stage-black text-xs uppercase tracking-wider">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + roundJudges.length + 1}
                  className="px-3 py-4 text-center text-ink-muted"
                >
                  {round.isTeamEvent ? 'No teams formed yet.' : 'No participants in this round.'}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const judgeScores = roundJudges.map((judge) => {
                  const scoreDoc = scores.find(
                    (s) => s.chestNo === row.id && s.judgeId === judge.id,
                  );
                  return scoreDoc?.score ?? null;
                });

                const submittedScores = judgeScores.filter((s): s is number => s !== null);
                const finalScore = computeRoundScore(submittedScores, round.scoringType);
                const rowBg = rowIdx % 2 === 0 ? 'bg-stage-black' : 'bg-stage-charcoal';

                return (
                  <tr key={row.id} className={rowBg}>
                    <td className="px-3 py-2 text-ink text-xs">{row.label}</td>
                    {judgeScores.map((score, idx) => (
                      <td
                        key={roundJudges[idx].id}
                        className="px-3 py-2 text-center text-ink text-xs"
                      >
                        {score !== null ? (
                          score.toFixed(1)
                        ) : (
                          <span className="text-ink-muted/40">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-bold text-spotlight-gold bg-stage-black whitespace-nowrap text-sm">
                      {submittedScores.length > 0 ? (
                        finalScore.toFixed(2)
                      ) : (
                        <span className="text-ink-muted/40">—</span>
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


// ─── CumulativeTotalsSection ──────────────────────────────────────────────────

interface CumulativeTotalsSectionProps {
  participants: ParticipantDoc[];
}

function CumulativeTotalsSection({ participants }: CumulativeTotalsSectionProps) {
  const [totals, setTotals] = useState<import('../../types').ChestNoPointsTotalsDoc[]>([]);

  useEffect(() => {
    import('../../lib/firestore').then(({ getChestNoPointsTotals }) => {
      getChestNoPointsTotals().then(setTotals);
    });
  }, []);

  const totalsByChestNo = new Map(totals.map((t) => [t.chestNo, t]));

  const rows = participants.map((participant) => ({
    participant,
    total: totalsByChestNo.get(participant.chestNo)?.overallPoints ?? 0,
  }));

  const sorted = [...rows].sort((a, b) => b.total - a.total);

  const top3: Array<{ chestNo: string; name: string; score: number; rank: 1 | 2 | 3 }> = [];
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const { participant, total } = sorted[i];
    if (total <= 0) break; // don't podium people with zero points
    top3.push({
      chestNo: participant.chestNo,
      name: participant.name,
      score: total,
      rank: (i + 1) as 1 | 2 | 3,
    });
  }

  return (
    <>
      {top3.length >= 2 && <PodiumView top3={top3} />}

      <div className="overflow-x-auto rounded-lg border border-ink-muted/10">
        <table className="min-w-full text-sm">
          <thead className="bg-stage-charcoal border-b border-ink-muted/10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-muted whitespace-nowrap text-xs uppercase tracking-wider">
                Rank
              </th>
              <th className="px-3 py-2 text-left font-medium text-ink-muted whitespace-nowrap text-xs uppercase tracking-wider">
                Chest No
              </th>
              <th className="px-3 py-2 text-left font-medium text-ink-muted text-xs uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 text-left font-medium text-ink-muted text-xs uppercase tracking-wider">Group</th>
              <th className="px-3 py-2 text-center font-medium text-spotlight-gold whitespace-nowrap bg-stage-black text-xs uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink-muted">
                  No results yet.
                </td>
              </tr>
            ) : (
              sorted.map(({ participant, total }, idx) => {
                const rowBg = idx % 2 === 0 ? 'bg-stage-black' : 'bg-stage-charcoal';
                return (
                  <tr key={participant.chestNo} className={rowBg}>
                    <td className="px-3 py-2 text-ink-muted font-medium text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-ink-muted text-xs">{participant.chestNo}</td>
                    <td className="px-3 py-2 text-ink text-xs">{participant.name}</td>
                    <td className="px-3 py-2 text-ink-muted text-xs">{participant.group}</td>
                    <td className="px-3 py-2 text-center font-bold text-spotlight-gold bg-stage-black text-sm">
                      {total.toFixed(2)}
                    </td>
                  </tr>
                );
              })
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

  const activeRounds = allRounds.filter(
    (r) =>
      (r.status === 'live' || r.status === 'locked') &&
      (group === 'all' || r.group === group),
  );

  const participants = allParticipants.filter(
    (p) => group === 'all' || p.group === group,
  );

  const lockedRounds = activeRounds.filter((r) => r.status === 'locked');

  if (activeRounds.length === 0) {
    return (
      <div className="py-12 text-center text-ink-muted text-base">
        No live or locked rounds yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeRounds.map((round) => (
        <RoundScoreTable
          key={round.id}
          round={round}
          participants={participants}
          events={events}
          judges={judges}
        />
      ))}

      {lockedRounds.length > 0 && (
          <div className="pt-4 border-t border-ink-muted/10">
          <h3 className="font-display text-2xl text-ink tracking-wide mb-4">
             Cumulative Totals
          </h3>
          <CumulativeTotalsSection participants={participants} />
          </div>
    )}
    </div>
  );
}
