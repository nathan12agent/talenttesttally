'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
}: {
  title: string;
  rows: LeaderboardRow[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-10">#</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Chest No</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 bg-gray-100 whitespace-nowrap">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                  No points recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.chestNo} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 font-medium">{row.rank}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{row.chestNo}</td>
                  <td className="px-3 py-2 text-gray-800">{row.name}</td>
                  <td className="px-3 py-2 text-center font-bold text-gray-900 bg-gray-50">
                    {row.points}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PointsDashboard({ participants }: PointsDashboardProps) {
  const [totals, setTotals] = useState<ChestNoPointsTotalsDoc[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chestNoPointsTotals'), (snap) => {
      setTotals(snap.docs.map((d) => d.data() as ChestNoPointsTotalsDoc));
    });
    return unsubscribe;
  }, []);

  const participantMap = new Map(participants.map((p) => [p.chestNo, p]));
  const totalsMap = new Map(totals.map((t) => [t.chestNo, t]));

  function buildRows(filter: (p: ParticipantDoc) => boolean, getPoints: (t: ChestNoPointsTotalsDoc | undefined) => number): LeaderboardRow[] {
    const filtered = participants.filter(filter);
    const withPoints = filtered.map((p) => ({
      chestNo: p.chestNo,
      name: p.name,
      group: p.group,
      points: getPoints(totalsMap.get(p.chestNo)),
    }));
    const sorted = withPoints.sort((a, b) => b.points - a.points);

    // Assign ranks — shared rank on tie
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
    'Jr': buildRows((p) => p.group === 'Jr', (t) => t?.perGroupPoints?.['Jr'] ?? 0),
    'Intermediate': buildRows((p) => p.group === 'Intermediate', (t) => t?.perGroupPoints?.['Intermediate'] ?? 0),
    'Senior': buildRows((p) => p.group === 'Senior', (t) => t?.perGroupPoints?.['Senior'] ?? 0),
  };

  void participantMap; // suppress unused warning

  return (
    <div className="flex flex-col gap-8">
      {/* Overall leaderboard */}
      <LeaderboardTable title="🏆 Overall Points" rows={overallRows} />

      {/* Per-group leaderboards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {GROUPS.map((group) => (
          <LeaderboardTable
            key={group}
            title={group}
            rows={groupRows[group]}
          />
        ))}
      </div>
    </div>
  );
}
