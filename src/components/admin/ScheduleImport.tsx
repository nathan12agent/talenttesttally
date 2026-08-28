'use client';

import { useRef, useState } from 'react';
import { parseScheduleCsv } from '../../lib/scheduleParser';
import {
  createEvent,
  createRound,
  getOffStageJudgeAssignments,
  getParticipantChestNosForGroup,
} from '../../lib/firestore';
import type { EventDoc, ScheduleRow, ParseError, JudgeDoc } from '../../types';

type ImportState = 'idle' | 'importing' | 'success';

interface ScheduleImportProps {
  events: EventDoc[];
  judges: JudgeDoc[];
  onImported: () => void;
}

/**
 * Imports a schedule file (event name, location, scoringMode, group,
 * scheduledOrder) and auto-generates events + rounds. Off-stage
 * (singleByGroup) rounds auto-assign the judge from offStageJudgeAssignments;
 * onstage (averaged) rounds assign all judges. Participant chest numbers per
 * round are pulled LIVE from Firestore at import time (not from a possibly
 * stale in-memory prop) — this avoids the empty-participantChestNos bug that
 * occurs if a schedule import runs before all participants are in Firestore.
 */
export function ScheduleImport({ events, judges, onImported }: ScheduleImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validRows, setValidRows] = useState<ScheduleRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidRows([]);
    setErrors([]);
    setConflicts([]);
    setImportState('idle');
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;
      const result = parseScheduleCsv(text);
      setValidRows(result.rows);
      setErrors(result.errors);
      setConflicts(result.conflicts);
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (validRows.length === 0) return;

    setImportState('importing');
    setImportError(null);

    try {
      const offStageAssignments = await getOffStageJudgeAssignments();
      const allJudgeIds = judges.map((j) => j.id);

      const existingByName = new Map(events.map((e) => [e.name.toLowerCase(), e]));
      const eventIdCache = new Map<string, string>();

      for (const row of validRows) {
        const key = row.eventName.toLowerCase();
        let eventId = eventIdCache.get(key) ?? existingByName.get(key)?.id;

        if (!eventId) {
          eventId = await createEvent(row.eventName, row.location, row.scoringMode);
          eventIdCache.set(key, eventId);
        }

        // Live fetch — always reflects whatever's actually in Firestore right
        // now, regardless of whether participants were imported before or
        // after this schedule file.
                // Live fetch — always reflects whatever's actually in Firestore right
        // now, regardless of whether participants were imported before or
        // after this schedule file.
        const groupParticipants = await getParticipantChestNosForGroup(row.group, row.gender);

        const assignedJudgeIds =
          row.scoringMode === 'singleByGroup'
            ? offStageAssignments[row.group]
              ? [offStageAssignments[row.group].judgeId]
              : []
            : allJudgeIds;

        // Common rounds are team events — teams get formed on the spot via
        // TeamBuilder, not pulled from a fixed roster tagged group 'Common'
        // (no such participants exist).
        const isTeamEvent = row.group === 'Common';

        await createRound({
          eventId,
          group: row.group,
          scoringType: row.scoringMode === 'averaged' ? 'averaged' : 'single',
          assignedJudgeIds,
          participantChestNos: isTeamEvent ? [] : groupParticipants,
          scheduledOrder: row.scheduledOrder,
          status: 'pending',
          batchMode: row.location === 'offstage',
          isTeamEvent,
          ...(row.gender ? { gender: row.gender } : {}), // omit key entirely — Firestore rejects `undefined`
        });
      }

      setImportedCount(validRows.length);
      setImportState('success');
      setValidRows([]);
      setErrors([]);
      setConflicts([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImported();
    } catch (err) {
      setImportState('idle');
      setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Import Schedule</h2>
      <p className="text-sm text-gray-500">
        Columns: <code>eventName, location, scoringMode, group, scheduledOrder</code>.{' '}
        <code>scoringMode</code> is optional — it defaults from <code>location</code>{' '}
        (onstage → averaged, offstage → singleByGroup). Set it explicitly for exceptions
        like Bible Quiz (onstage + singleByGroup).
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="schedule-csv-input" className="text-sm font-medium text-gray-700">
          Upload schedule CSV
        </label>
        <input
          id="schedule-csv-input"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600
            file:mr-3 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-medium
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            cursor-pointer"
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-sm font-medium text-red-700">
            {errors.length} row{errors.length !== 1 ? 's' : ''} with errors:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((err, i) => (
              <li key={i} className="text-sm text-red-600">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-sm font-medium text-amber-700">Scheduling conflicts:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {conflicts.map((c, i) => (
              <li key={i} className="text-sm text-amber-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Preview — {validRows.length} row{validRows.length !== 1 ? 's' : ''}:
          </p>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Event</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Location</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Scoring Mode</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Group</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Gender</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validRows.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2 text-gray-800">{r.eventName}</td>
                    <td className="px-4 py-2 text-gray-800">{r.location}</td>
                    <td className="px-4 py-2 text-gray-800">{r.scoringMode}</td>
                    <td className="px-4 py-2 text-gray-800">{r.group}</td>
                    <td className="px-4 py-2 text-gray-800">{r.gender ?? 'both'}</td>
                    <td className="px-4 py-2 text-gray-800">{r.scheduledOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={importState === 'importing'}
            className="mt-2 w-full sm:w-auto rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importState === 'importing' ? 'Importing…' : 'Confirm & Generate Events/Rounds'}
          </button>
        </div>
      )}

      {importError && (
        <p className="text-sm text-red-600" role="alert">
          {importError}
        </p>
      )}

      {importState === 'success' && (
        <p className="text-sm font-medium text-green-700" role="status">
          Imported {importedCount} classes{importedCount !== 1 ? '' : ''} imported.
        </p>
      )}
    </section>
  );
}