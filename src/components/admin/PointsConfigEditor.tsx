'use client';

import { useState, useEffect } from 'react';
import {
  getDefaultPointsConfig,
  setDefaultPointsConfig,
  getPointsConfig,
  setPointsConfig,
} from '../../lib/firestore';
import type { EventDoc } from '../../types';

interface PointsConfigEditorProps {
  events: EventDoc[];
}

interface EventPoints {
  eventId: string;
  first: number;
  second: number;
  third: number;
}

export function PointsConfigEditor({ events }: PointsConfigEditorProps) {
  const [defaultFirst, setDefaultFirst] = useState(5);
  const [defaultSecond, setDefaultSecond] = useState(3);
  const [defaultThird, setDefaultThird] = useState(1);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultMessage, setDefaultMessage] = useState('');

  const [eventPoints, setEventPoints] = useState<Record<string, EventPoints>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  // Load the saved default on mount
  useEffect(() => {
    getDefaultPointsConfig().then((config) => {
      if (config) {
        setDefaultFirst(config.first);
        setDefaultSecond(config.second);
        setDefaultThird(config.third);
      }
    });
  }, []);

  // Load current points for every event
  useEffect(() => {
    async function loadAll() {
      setLoadingEvents(true);
      const entries = await Promise.all(
        events.map(async (ev) => {
          const config = await getPointsConfig(ev.id);
          return [
            ev.id,
            {
              eventId: ev.id,
              first: config?.first ?? 0,
              second: config?.second ?? 0,
              third: config?.third ?? 0,
            },
          ] as const;
        }),
      );
      setEventPoints(Object.fromEntries(entries));
      setLoadingEvents(false);
    }
    if (events.length > 0) loadAll();
    else setLoadingEvents(false);
  }, [events]);

  async function handleSaveDefault() {
    setSavingDefault(true);
    setDefaultMessage('');
    try {
      await setDefaultPointsConfig({ first: defaultFirst, second: defaultSecond, third: defaultThird });
      setDefaultMessage('Default saved — new events will use these values automatically.');
    } catch {
      setDefaultMessage('Failed to save default. Please try again.');
    } finally {
      setSavingDefault(false);
    }
  }

  async function handleApplyDefaultToAll() {
    setSavingDefault(true);
    setDefaultMessage('');
    try {
      await Promise.all(
        events.map((ev) =>
          setPointsConfig(ev.id, { first: defaultFirst, second: defaultSecond, third: defaultThird }),
        ),
      );
      setEventPoints((prev) => {
        const updated = { ...prev };
        events.forEach((ev) => {
          updated[ev.id] = { eventId: ev.id, first: defaultFirst, second: defaultSecond, third: defaultThird };
        });
        return updated;
      });
      setDefaultMessage(`Applied to all ${events.length} existing events.`);
    } catch {
      setDefaultMessage('Failed to apply to some events. Please try again.');
    } finally {
      setSavingDefault(false);
    }
  }

  function updateEventField(eventId: string, field: 'first' | 'second' | 'third', value: number) {
    setEventPoints((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], [field]: value },
    }));
  }

  async function handleSaveEvent(eventId: string) {
    const points = eventPoints[eventId];
    if (!points) return;
    setSavingEventId(eventId);
    try {
      await setPointsConfig(eventId, { first: points.first, second: points.second, third: points.third });
    } finally {
      setSavingEventId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Default — applies automatically to every new event */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 bg-white">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Default Points</h3>
          <p className="text-xs text-gray-500 mt-1">
            Applied automatically to every new event you create — set once, stays constant
            regardless of when events get added.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm font-medium text-gray-700">1st place</label>
            <input
              type="number"
              value={defaultFirst}
              onChange={(e) => setDefaultFirst(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-base"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm font-medium text-gray-700">2nd place</label>
            <input
              type="number"
              value={defaultSecond}
              onChange={(e) => setDefaultSecond(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-base"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm font-medium text-gray-700">3rd place</label>
            <input
              type="number"
              value={defaultThird}
              onChange={(e) => setDefaultThird(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-base"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveDefault}
            disabled={savingDefault}
            className="min-h-[44px] px-5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {savingDefault ? 'Saving…' : 'Save Default'}
          </button>
          <button
            onClick={handleApplyDefaultToAll}
            disabled={savingDefault || events.length === 0}
            className="min-h-[44px] px-5 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            Apply to All {events.length} Existing Events
          </button>
        </div>

        {defaultMessage && <p className="text-sm text-gray-600">{defaultMessage}</p>}
      </div>

      {/* Per-event override */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Per-Event Points</h3>
        <p className="text-xs text-gray-500">
          Override an individual event if it needs different values than the default.
        </p>

        {loadingEvents ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((ev) => {
              const points = eventPoints[ev.id] ?? { eventId: ev.id, first: 0, second: 0, third: 0 };
              return (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3"
                >
                  <span className="text-sm font-medium text-gray-800 min-w-[140px]">{ev.name}</span>
                  <input
                    type="number"
                    value={points.first}
                    onChange={(e) => updateEventField(ev.id, 'first', Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-gray-300 text-sm"
                    aria-label={`${ev.name} 1st place points`}
                  />
                  <input
                    type="number"
                    value={points.second}
                    onChange={(e) => updateEventField(ev.id, 'second', Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-gray-300 text-sm"
                    aria-label={`${ev.name} 2nd place points`}
                  />
                  <input
                    type="number"
                    value={points.third}
                    onChange={(e) => updateEventField(ev.id, 'third', Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-gray-300 text-sm"
                    aria-label={`${ev.name} 3rd place points`}
                  />
                  <button
                    onClick={() => handleSaveEvent(ev.id)}
                    disabled={savingEventId === ev.id}
                    className="ml-auto text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingEventId === ev.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}