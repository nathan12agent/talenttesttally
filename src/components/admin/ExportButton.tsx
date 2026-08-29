'use client';

import { useState, useEffect } from 'react';
import { Group, RoundDoc, ScoreDoc, ParticipantDoc, ChestNoPointsTotalsDoc, EventDoc } from '../../types';
import { buildResultsCsv, buildPointsTallyCsv } from '../../lib/csvExport';
import { getChestNoPointsTotals } from '../../lib/firestore';

interface ExportButtonProps {
  group: Group | 'all';
  rounds: RoundDoc[];
  scores: ScoreDoc[];
  participants: ParticipantDoc[];
  events: EventDoc[];
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ group, rounds, scores, participants, events }: ExportButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [totals, setTotals] = useState<ChestNoPointsTotalsDoc[]>([]);
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  useEffect(() => {
    getChestNoPointsTotals().then(setTotals).catch(() => {});
  }, []);

  const hasLockedRounds = rounds.some(
    (r) => r.status === 'locked' && (group === 'all' || r.group === group),
  );

  function handleDownloadResults() {
    const csv = buildResultsCsv(participants, rounds, scores, group, eventNameById);
    if (!csv) {
      setMessage('No data to export');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `results-${group}-${timestamp}.csv`);
    setMessage(null);
  }

  function handleDownloadPoints() {
    const csv = buildPointsTallyCsv(participants, totals, group);
    if (!csv) {
      setMessage('No points data to export');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `points-tally-${group}-${timestamp}.csv`);
    setMessage(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-sm text-amber-600">{message}</p>}

      <button
        onClick={handleDownloadResults}
        disabled={!hasLockedRounds}
        className="min-h-[48px] w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Download Current Standings CSV
      </button>

      <button
        onClick={handleDownloadPoints}
        className="min-h-[48px] w-full rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 active:bg-gray-900 transition-colors"
      >
        Download Podium / Points Tally CSV
      </button>
    </div>
  );
}