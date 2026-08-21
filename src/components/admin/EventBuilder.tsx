'use client';

import { useState } from 'react';
import { createEvent } from '../../lib/firestore';
import type { EventDoc } from '../../types';

interface EventBuilderProps {
  events: EventDoc[];
  onEventCreated: () => void;
}

export function EventBuilder({ events, onEventCreated }: EventBuilderProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<EventDoc['location']>('onstage');
  const [scoringMode, setScoringMode] = useState<EventDoc['scoringMode']>('averaged');
  const [scoringModeOverridden, setScoringModeOverridden] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleLocationChange(newLocation: EventDoc['location']) {
    setLocation(newLocation);
    if (!scoringModeOverridden) {
      setScoringMode(newLocation === 'onstage' ? 'averaged' : 'singleByGroup');
    }
  }

  function handleScoringModeChange(newMode: EventDoc['scoringMode']) {
    setScoringMode(newMode);
    setScoringModeOverridden(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = name.trim();

    if (!trimmed) {
      setError('Event name is required');
      return;
    }

    const duplicate = events.some(
      (ev) => ev.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setError('An event with this name already exists');
      return;
    }

    setLoading(true);
    try {
      await createEvent(trimmed, location, scoringMode);
      setName('');
      setLocation('onstage');
      setScoringMode('averaged');
      setScoringModeOverridden(false);
      onEventCreated();
    } catch {
      setError('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Event name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="eb-name" className="text-sm font-medium text-ink-muted">
          Event name <span aria-hidden="true">*</span>
        </label>
        <input
          id="eb-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Solo Singing"
          disabled={loading}
          aria-label="Event name"
          className="min-h-[48px] px-4 rounded-lg border border-ink-muted/30 text-base bg-stage-charcoal text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-spotlight-gold disabled:opacity-50"
        />
      </div>

      {/* Location */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-muted">Location</legend>
        <div className="flex gap-6">
          {(['onstage', 'offstage'] as EventDoc['location'][]).map((loc) => (
            <label key={loc} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="location"
                value={loc}
                checked={location === loc}
                onChange={() => handleLocationChange(loc)}
                disabled={loading}
                className="w-5 h-5 accent-spotlight-gold"
              />
              <span className="text-base capitalize text-ink">{loc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Scoring mode */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-muted">
          Scoring mode
          <span className="ml-2 text-xs font-normal text-ink-muted/70">
            (auto-suggested from location)
          </span>
        </legend>
        <div className="flex gap-6">
          {(['averaged', 'singleByGroup'] as EventDoc['scoringMode'][]).map((mode) => (
            <label key={mode} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="scoringMode"
                value={mode}
                checked={scoringMode === mode}
                onChange={() => handleScoringModeChange(mode)}
                disabled={loading}
                className="w-5 h-5 accent-spotlight-gold"
              />
              <span className="text-base text-ink">{mode === 'averaged' ? 'Averaged' : 'Single by group'}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {scoringMode === 'averaged'
            ? 'All assigned judges score; participant score = mean.'
            : 'One judge per group (set in Off-Stage Assignments) scores each group.'}
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-curtain-red text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="min-h-[48px] px-6 bg-spotlight-gold text-stage-black text-base font-bold rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity self-start"
      >
        {loading ? 'Creating…' : 'Create Event'}
      </button>
    </form>
  );
}