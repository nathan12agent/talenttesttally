'use client';

import { useRef, useState } from 'react';
import { parseScheduleCsv } from '../../lib/scheduleParser';
import { getOffStageJudgeAssignments, createEvent, createRound } from '../../lib/firestore';
import type { EventDoc, JudgeDoc } from '../../types';

interface ScheduleImportProps {
  judges: JudgeDoc[];
  onImported: () => void;
}

type ImportStatus = 'idle' | 'parsing' | 'writing' | 'done' | 'error';

export function ScheduleImport({ judges, onImported }: ScheduleImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<{ chestNo: string; rounds: string[] }[]>([]);
  const [summary, setSummary] = useState('');
  const [generalError, setGeneralError] = useState('');

  async function handleFile(file: File) {
    setParseErrors([]);
    setConflicts([]);
    setSummary('');
    setGeneralError('');
    setStatus('parsing');

    let csvText: string;
    try {
      csvText = await file.text();
    } catch {
      setGeneralError('Failed to read file.');
      setStatus('error');
      return;
    }

    const result = parseScheduleCsv(csvText);

    if (result.errors.length > 0) {
      setParseErrors(result.errors.map((e) => `Row ${e.row} [${e.field}]: ${e.message}`));
    }

    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts);
    }

    if (result.events.length === 0) {
      setStatus(result.errors.length > 0 ? 'error' : 'idle');
      return;
    }

    // ── Write to Firestore ──────────────────────────────────────────────────
    setStatus('writing');

    try {
      // Look up off-stage judge assignments for singleByGroup rounds
      const offStageAssignments = await getOffStageJudgeAssignments();

      // Write events and collect name → id map
      const eventIdMap = new Map<string, string>();
      for (const ev of result.events) {
        const id = await createEvent(ev.name, ev.location, ev.scoringMode);
        eventIdMap.set(ev.name.toLowerCase(), id);
      }

      // Write rounds
      let roundsWritten = 0;
      for (const r of result.rounds) {
        const eventId = eventIdMap.get(r.eventId) ?? r.eventId;

        // Determine event location to set batchMode correctly
        const evData = result.events.find((e) => e.name.toLowerCase() === r.eventId);
        const location = evData?.location ?? 'onstage';

        // Resolve assignedJudgeIds:
        // - averaged/onstage: all 3 judges
        // - singleByGroup: look up from offStageJudgeAssignments
        let assignedJudgeIds: string[];
        if (r.scoringType === 'averaged') {
          assignedJudgeIds = judges.map((j) => j.id);
        } else {
          const assignment = offStageAssignments[r.group];
          assignedJudgeIds = assignment ? [assignment.judgeId] : [];
        }

        await createRound({
          eventId,
          group: r.group,
          scoringType: r.scoringType,
          batchMode: location === 'offstage',
          assignedJudgeIds,
          participantChestNos: r.participantChestNos,
          scheduledOrder: r.scheduledOrder,
          status: 'pending',
          scoreMin: r.scoreMin,
          scoreMax: r.scoreMax,
        });
        roundsWritten++;
      }

      setSummary(
        `Imported ${result.events.length} event${result.events.length !== 1 ? 's' : ''} and ${roundsWritten} round${roundsWritten !== 1 ? 's' : ''}.`,
      );
      setStatus('done');
      onImported();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to write to Firestore.');
      setStatus('error');
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }

  const busy = status === 'parsing' || status === 'writing';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Upload a CSV with columns: <code>eventName, location, scoringMode (optional), group, scheduledOrder</code>.
        One row per event × group combination. Rounds are auto-generated with judge assignments
        derived from Off-Stage Assignments (for single-by-group events).
      </p>

      <label
        htmlFor="schedule-csv"
        className={`min-h-[48px] flex items-center justify-center gap-2 px-4 rounded-lg border-2 border-dashed cursor-pointer text-sm font-medium transition-colors ${
          busy
            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
            : 'border-blue-300 text-blue-600 hover:bg-blue-50'
        }`}
      >
        {busy ? (status === 'parsing' ? 'Parsing…' : 'Writing to Firestore…') : '📁 Choose schedule CSV'}
        <input
          id="schedule-csv"
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleInputChange}
          disabled={busy}
          className="sr-only"
        />
      </label>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col gap-1">
          <p className="text-sm font-medium text-red-700">Parse errors (rows were skipped):</p>
          <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scheduling conflicts — warning, non-blocking */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-700">
            ⚠️ Scheduling conflicts detected (rounds share the same order slot):
          </p>
          <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.chestNo}: {c.rounds.join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-600 mt-1">Import was not blocked — review and adjust order manually if needed.</p>
        </div>
      )}

      {/* General error */}
      {generalError && (
        <p role="alert" className="text-red-600 text-sm">
          {generalError}
        </p>
      )}

      {/* Success */}
      {status === 'done' && summary && (
        <p className="text-green-700 text-sm font-medium">✓ {summary}</p>
      )}
    </div>
  );
}
