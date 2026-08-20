'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ChestBadge } from '../shared/ChestBadge';
import type { Group, ChestNoPointsTotalsDoc, ParticipantDoc } from '../../types';

const GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];

interface PointsDashboardProps {
  participants: ParticipantDoc[];
}

interface LeaderboardRow {
  rank: number;
  chestNo: string;
  name: string;
  group: Group;
  points: number;
}

function LeaderboardTable({
  title,
  rows,
  isOverall,
}: {
  title: string;
  rows: LeaderboardRow[];
  isOverall?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3
        className={`font-display tracking-wide ${
          isOverall ? 'text-3xl text-spotlight-gold' : 'text-xl text-ink'
        }`}
      >
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-ink-muted/10">
        <table className="min-w-full text-sm">
          <thead className="bg-stage-charcoal border-b border-ink-muted/10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-muted w-10 text-xs uppercase tracking-wider">#</th>
              <th className="px-3 py-2 text-left font-medium text-ink-muted whitespace-nowrap text-xs uppercase tracking-wider">
                Chest
              </th>
              <th className="px-3 py-2 text-left font-medium text-ink-muted text-xs uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 text-center font-medium text-spotlight-gold bg-stage-black whitespace-nowrap text-xs uppercase tracking-wider">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-ink-muted text-xs">
                  No points recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const rowBg = idx % 2 === 0 ? 'bg-stage-black' : 'bg-stage-charcoal';
                return (
                  <tr key={row.chestNo} className={rowBg}>
                    <td className="px-3 py-2 text-ink-muted font-medium text-xs">{row.rank}</td>
                    <td className="px-3 py-2">
                      <ChestBadge chestNo={row.chestNo} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-ink text-xs">{row.name}</td>
                    <td className="px-3 py-2 text-center bg-stage-black">
                      <span className="font-display text-2xl text-spotlight-gold">
                        {row.points}
                      </span>
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

export function PointsDashboard({ participants }: PointsDashboardProps) {
  const [totals, setTotals] = useState<ChestNoPointsTotalsDoc[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | 'overall'>('overall');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chestNoPointsTotals'), (snap) => {
      setTotals(snap.docs.map((d) => d.data() as ChestNoPointsTotalsDoc));
    });
    return unsubscribe;
  }, []);

  const totalsMap = new Map(totals.map((t) => [t.chestNo, t]));

  function buildRows(
    filter: (p: ParticipantDoc) => boolean,
    getPoints: (t: ChestNoPointsTotalsDoc | undefined) => number,
  ): LeaderboardRow[] {
    const filtered = participants.filter(filter);
    const withPoints = filtered.map((p) => ({
      chestNo: p.chestNo,
      name: p.name,
      group: p.group,
      points: getPoints(totalsMap.get(p.chestNo)),
    }));
    const sorted = withPoints.sort((a, b) => b.points - a.points);

    const ranked: LeaderboardRow[] = [];
    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].points < sorted[i - 1].points) {
        rank = i + 1;
      }
      ranked.push({ ...sorted[i], rank });
    }
    return ranked;
  }

  const overallRows = buildRows(
    () => true,
    (t) => t?.overallPoints ?? 0,
  );

  const groupRows: Record<Group, LeaderboardRow[]> = {
    'Sub Jr': buildRows((p) => p.group === 'Sub Jr', (t) => t?.perGroupPoints?.['Sub Jr'] ?? 0),
    Jr: buildRows((p) => p.group === 'Jr', (t) => t?.perGroupPoints?.['Jr'] ?? 0),
    Intermediate: buildRows((p) => p.group === 'Intermediate', (t) => t?.perGroupPoints?.['Intermediate'] ?? 0),
    Senior: buildRows((p) => p.group === 'Senior', (t) => t?.perGroupPoints?.['Senior'] ?? 0),
  };

  const tabGroups: Array<{ id: Group | 'overall'; label: string }> = [
    { id: 'overall', label: '🏆 Overall' },
    ...GROUPS.map((g) => ({ id: g as Group, label: g })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Group tabs */}
      <div className="flex flex-wrap gap-2">
        {tabGroups.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveGroup(tab.id)}
            className={`min-h-[40px] px-4 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-spotlight-gold ${
              activeGroup === tab.id
                ? tab.id === 'overall'
                  ? 'bg-spotlight-gold text-stage-black border-spotlight-gold'
                  : 'bg-curtain-red text-ink border-curtain-red'
                : 'bg-transparent text-ink-muted border-ink-muted/40 hover:border-ink hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active table */}
      {activeGroup === 'overall' ? (
        <LeaderboardTable title="🏆 Overall Points" rows={overallRows} isOverall />
      ) : (
        <LeaderboardTable title={activeGroup} rows={groupRows[activeGroup]} />
      )}
    </div>
  );
}
