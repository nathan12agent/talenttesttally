'use client';

import { useState, useEffect } from 'react';
import { getPointsConfig, setPointsConfig } from '../../lib/firestore';
import type { EventDoc } from '../../types';

interface PointsConfigEditorProps {
  events: EventDoc[];
}

export function PointsConfigEditor({ events }: PointsConfigEditorProps) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [first, setFirst] = useState(0);
  const [second, setSecond] = useState(0);
  const [third, setThird] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!selectedEventId) {
      setFirst(0);
      setSecond(0);
      setThird(0);
      return;
    }
    setLoading(true);
    getPointsConfig(selectedEventId)
      .then((config) => {
        setFirst(config?.first ?? 0);
        setSecond(config?.second ?? 0);
        setThird(config?.third ?? 0);
      })
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  async function handleSave() {
    if (!selectedEventId) return;
    setSaving(true);
    setMessage('');
    try {
      await setPointsConfig(selectedEventId, { first, second, third });
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="pc-event" className="text-sm font-medium text-gray-700">
          Event
        </label>
        <select
          id="pc-event"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {selectedEventId && (
        <>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">1st place</label>
              <input
                type="number"
                value={first}
                onChange={(e) => setFirst(Number(e.target.value))}
                disabled={loading}
                className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">2nd place</label>
              <input
                type="number"
                value={second}
                onChange={(e) => setSecond(Number(e.target.value))}
                disabled={loading}
                className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">3rd place</label>
              <input
                type="number"
                value={third}
                onChange={(e) => setThird(Number(e.target.value))}
                disabled={loading}
                className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base disabled:opacity-50"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="min-h-[48px] px-6 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 self-start"
          >
            {saving ? 'Saving…' : 'Save Points'}
          </button>

          {message && <p className="text-sm text-gray-600">{message}</p>}
        </>
      )}
    </div>
  );
}