'use client';

import { useRef, useState } from 'react';
import { parseParticipantCsv } from '../../lib/csvParser';
import { upsertParticipant } from '../../lib/firestore';
import type { ParticipantDoc, ParseError } from '../../types';

type ImportState = 'idle' | 'importing' | 'success';

export function ParticipantImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validRows, setValidRows] = useState<ParticipantDoc[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setValidRows([]);
    setErrors([]);
    setImportState('idle');
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;
      const result = parseParticipantCsv(text);
      setValidRows(result.participants);
      setErrors(result.errors);
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (validRows.length === 0) return;

    setImportState('importing');
    setImportError(null);

    try {
      for (const participant of validRows) {
        await upsertParticipant(participant);
      }
      setImportedCount(validRows.length);
      setImportState('success');
      // Reset file input and preview
      setValidRows([]);
      setErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setImportState('idle');
      setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Import Participants</h2>

      {/* File upload + template download */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="participant-csv-input"
            className="text-sm font-medium text-gray-700"
          >
            Upload CSV
          </label>
          <input
            id="participant-csv-input"
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

        <a
          href="/participants-template.csv"
          download
          className="inline-flex items-center gap-1 text-sm text-blue-600 underline hover:text-blue-800 self-end pb-2"
        >
          Download CSV Template
        </a>
      </div>

      {/* Error list */}
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

      {/* Preview table */}
      {validRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Preview — {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}:
          </p>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Chest No</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validRows.map((p) => (
                  <tr key={p.chestNo} className="bg-white">
                    <td className="px-4 py-2 text-gray-800">{p.chestNo}</td>
                    <td className="px-4 py-2 text-gray-800">{p.name}</td>
                    <td className="px-4 py-2 text-gray-800">{p.group}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirmImport}
            disabled={importState === 'importing'}
            className="mt-2 w-full sm:w-auto rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importState === 'importing' ? 'Importing…' : 'Confirm & Import'}
          </button>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <p className="text-sm text-red-600" role="alert">
          {importError}
        </p>
      )}

      {/* Success message */}
      {importState === 'success' && (
        <p className="text-sm font-medium text-green-700" role="status">
          Imported {importedCount} participant{importedCount !== 1 ? 's' : ''} successfully.
        </p>
      )}
    </section>
  );
}
