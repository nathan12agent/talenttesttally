'use client';

import { useState } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { useScores } from '../../hooks/useScores';
import { updateRoundStatus, computePodiumOnLock } from '../../lib/firestore';
import { ChestBadge } from '../shared/ChestBadge';
import type { EventDoc, RoundDoc } from '../../types';

// ── Judge-submission progress dots ───────────────────────────────────────────

function SubmissionDots({
  submitted,
  expected,
}: {
  submitted: number;
  expected: number;
}) {
  const dots = Array.from({ length: expected }, (_, i) => i < submitted);
  return (
    <div className="flex items-center gap-1" aria-label={`${submitted} of ${expected} judges submitted`}>
      {dots.map((filled, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border ${
            filled
              ? 'bg-spotlight-gold border-spotlight-gold'
              : 'bg-transparent border-ink-muted/40'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RoundDoc['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <span className="w-2 h-2 rounded-full bg-ink-muted/50" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-spotlight-gold">
        <span className="w-2 h-2 rounded-full bg-spotlight-gold animate-live-glow" aria-hidden="true" />
        <span className="font-display text-sm tracking-wider">LIVE</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
      <span aria-hidden="true">🔒</span>
      Locked
    </span>
  );
}

// ── Round control card ────────────────────────────────────────────────────────

interface RoundControlCardProps {
  round: RoundDoc;
  eventName: string;
}

function RoundControlCard({ round, eventName }: RoundControlCardProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [podiumWarning, setPodiumWarning] = useState('');

  const scores = useScores(round.id);

  async function handleSetLive() {
    setSaving(true);
    setError('');
    try {
      await updateRoundStatus(round.id, 'live');
    } catch {
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    setSaving(true);
    setError('');
    setPodiumWarning('');
    try {
      await updateRoundStatus(round.id, 'locked');
      const podium = await computePodiumOnLock(round.id);

      if (!podium.pointsConfigured) {
        setPodiumWarning(
          "Round locked, but no podium points are configured for this event yet — 0 points were recorded. Set points in the event's config to award them retroactively.",
        );
      } else if (podium.hasTie) {
        setPodiumWarning(
          'Round locked. A tie was detected in the top 3 — tied chest numbers received equal points for their shared rank. Review the podium if this needs manual adjustment.',
        );
      }
    } catch {
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const submittedJudgeIds = new Set(scores.map((s) => s.judgeId));
  const submitted = submittedJudgeIds.size;
  const expected = round.assignedJudgeIds.length;

  return (
    <div
      className={`rounded-xl bg-stage-charcoal p-4 flex flex-col gap-3 border ${
        round.status === 'live'
          ? 'border-spotlight-gold/40'
          : 'border-ink-muted/10'
      }`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink text-sm">{eventName}</span>
        <span className="text-ink-muted/40 text-xs">·</span>
        <span className="text-xs text-ink-muted">{round.group}</span>
        <StatusBadge status={round.status} />
        {round.batchMode && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-curtain-red/20 text-curtain-red border border-curtain-red/30">
            Batch
          </span>
        )}
      </div>

      {/* Participant count with chest icon motif */}
      <div className="flex items-center gap-2">
        <ChestBadge chestNo={String(round.participantChestNos.length)} size="sm" />
        <span className="text-xs text-ink-muted">
          participant{round.participantChestNos.length !== 1 ? 's' : ''} · Order #{round.scheduledOrder}
        </span>
      </div>

      {/* Judge submission progress */}
      {round.status === 'live' && (
        <div className="flex items-center gap-2">
          <SubmissionDots submitted={submitted} expected={expected} />
          <span className="text-xs text-ink-muted">
            {submitted}/{expected} judge{expected !== 1 ? 's' : ''} submitted
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-curtain-red text-xs">
          {error}
        </p>
      )}

      {podiumWarning && (
        <p
          role="alert"
          className="text-amber-400 text-xs bg-amber-900/20 border border-amber-600/30 rounded-lg px-3 py-2"
        >
          ⚠️ {podiumWarning}
        </p>
      )}

      {/* Action buttons */}
      {round.status === 'pending' && (
        <button
          onClick={handleSetLive}
          disabled={saving}
          className="min-h-[48px] px-5 bg-spotlight-gold text-stage-black text-sm font-bold rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity self-start focus:outline-none focus:ring-2 focus:ring-spotlight-gold"
        >
          {saving ? 'Setting live…' : '→ Set Live'}
        </button>
      )}

      {round.status === 'live' && (
        <button
          onClick={handleLock}
          disabled={saving}
          className="min-h-[48px] px-5 bg-curtain-red text-ink text-sm font-bold rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity self-start focus:outline-none focus:ring-2 focus:ring-curtain-red"
        >
          {saving ? 'Locking…' : '🔒 Lock Round'}
        </button>
      )}

      {round.status === 'locked' && (
        <span className="text-xs text-ink-muted font-medium">🔒 Locked</span>
      )}
    </div>
  );
}

// ── Track section ─────────────────────────────────────────────────────────────

interface TrackSectionProps {
  title: string;
  icon: string;
  accentClass: string;
  rounds: RoundDoc[];
  eventMap: Map<string, string>;
}

function TrackSection({ title, icon, accentClass, rounds, eventMap }: TrackSectionProps) {
  return (
    <div className="flex-1 min-w-[280px]">
      <h3
        className={`flex items-center gap-2 font-display text-2xl tracking-wide mb-4 ${accentClass}`}
      >
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      {rounds.length === 0 ? (
        <p className="text-ink-muted text-sm py-4">No rounds in this track.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rounds.map((round) => (
            <RoundControlCard
              key={round.id}
              round={round}
              eventName={eventMap.get(round.eventId) ?? round.eventId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface LiveControlProps {
  events: EventDoc[];
}

export function LiveControl({ events }: LiveControlProps) {
  const rounds = useRounds();

  const eventMap = new Map(events.map((e) => [e.id, e.name]));
  const locationById = new Map(events.map((e) => [e.id, e.location]));

  if (rounds.length === 0) {
    return <p className="text-ink-muted text-sm py-4">No rounds created yet.</p>;
  }

  const onStageRounds = rounds.filter((r) => locationById.get(r.eventId) === 'onstage');
  const offStageRounds = rounds.filter((r) => locationById.get(r.eventId) === 'offstage');

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <TrackSection
        title="On Stage"
        icon="🎯"
        accentClass="text-spotlight-gold"
        rounds={onStageRounds}
        eventMap={eventMap}
      />
      <TrackSection
        title="Off Stage"
        icon="📋"
        accentClass="text-curtain-red"
        rounds={offStageRounds}
        eventMap={eventMap}
      />
    </div>
  );
}
