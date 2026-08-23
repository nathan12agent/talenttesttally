// New component: BulkPointsConfig.tsx (or add as a section inside your existing PointsConfiguration component)

'use client';

import { useState } from 'react';
import { setPointsConfig } from '../../lib/firestore';
import type { EventDoc } from '../../types';

interface BulkPointsConfigProps {
  events: EventDoc[];
  onApplied: () => void;
}

export function BulkPointsConfig({ events, onApplied }: BulkPointsConfigProps) {
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [first, setFirst] = useState(5);
  const [second, setSecond] = useState(3);
  const [third, setThird] = useState(1);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  function toggleEvent(eventId: string) {
    setSelectAll(false);
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  }

  function handleSelectAllToggle() {
    if (selectAll) {
      setSelectedEventIds([]);
      setSelectAll(false);
    } else {
      setSelectedEventIds(events.map((e) => e.id));
      setSelectAll(true);
    }
  }

  async function handleApply() {
    const targets = selectAll ? events.map((e) => e.id) : selectedEventIds;
    if (targets.length === 0) {
      setMessage('Select at least one event.');
      return;
    }

    setApplying(true);
    setMessage('');
    try {
      await Promise.all(
        targets.map((eventId) => setPointsConfig(eventId, { first, second, third })),
      );
      setMessage(`Applied ${first}/${second}/${third} points to ${targets.length} event${targets.length !== 1 ? 's' : ''}.`);
      onApplied();
    } catch {
      setMessage('Failed to apply to some events. Please try again.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className="text-sm font-semibold text-gray-800">Bulk Apply Points</h3>
      <p className="text-xs text-gray-500">
        Set the same 1st/2nd/3rd point values across multiple events at once —
        faster than configuring each one individually.
      </p>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-sm font-medium text-gray-700">1st place</label>
          <input
            type="number"
            value={first}
            onChange={(e) => setFirst(Number(e.target.value))}
            disabled={applying}
            className="min-h-[44px] px-3 rounded-lg border border-gray-300 text-base disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-sm font-medium text-gray-700">2nd place</label>
          <input
            type="number"
            value={second}
            onChange={(e) => setSecond(Number(e.target.value))}
            disabled={applying}
            className="min-h-[44px] px-3 rounded-lg border border-gray-300 text-base disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-sm font-medium text-gray-700">3rd place</label>
          <input
            type="number"
            value={third}
            onChange={(e) => setThird(Number(e.target.value))}
            disabled={applying}
            className="min-h-[44px] px-3 rounded-lg border border-gray-300 text-base disabled:opacity-50"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={handleSelectAllToggle}
          disabled={applying}
          className="w-4 h-4"
        />
        Apply to all events ({events.length})
      </label>

      {!selectAll && (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {events.map((ev) => (
            <label key={ev.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEventIds.includes(ev.id)}
                onChange={() => toggleEvent(ev.id)}
                disabled={applying}
                className="w-4 h-4"
              />
              {ev.name} <span className="text-xs text-gray-400">({ev.location})</span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={applying}
        className="min-h-[44px] px-6 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 self-start"
      >
        {applying ? 'Applying…' : 'Apply to Selected Events'}
      </button>

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}