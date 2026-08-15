'use client';

import { useState } from 'react';
import { useRounds } from '../../hooks/useRounds';
import { useScores } from '../../hooks/useScores';
import { updateRoundStatus, computePodiumOnLock } from '../../lib/firestore';
import type { EventDoc, RoundDoc } from '../../types';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RoundDoc['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
        Pending
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
        Live
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      Locked
    </span>
  );
}

// ── Inner card ─────────────────────────────────────────────────────────────

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

      // Auto-compute podium + award points now that the round is final.
      const podium = await computePodiumOnLock(round.id);

      if (!podium.pointsConfigured) {
        setPodiumWarning(
          'Round locked, but no podium points are configured for this event yet — 0 points were recorded. Set points in the event\'s config to award them retroactively.',
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900 text-base">{eventName}</span>
        <span className="text-gray-400">·</span>
        <span className="text-sm text-gray-600">{round.group}</span>
        <StatusBadge status={round.status} />
        {round.batchMode && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            Batch
          </span>
        )}
      </div>

      <div className="text-sm text-gray-500">
        {round.participantChestNos.length} participant
        {round.participantChestNos.length !== 1 ? 's' : ''}
        {' · '}Order #{round.scheduledOrder}
      </div>

      {round.status === 'live' && (
        <div className="text-sm text-gray-700">
          {submitted} of {expected} judge{expected !== 1 ? 's' : ''} submitted
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}

      {podiumWarning && (
        <p role="alert" className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ {podiumWarning}
        </p>
      )}

      {round.status === 'pending' && (
        <button
          onClick={handleSetLive}
          disabled={saving}
          className="min-h-[48px] px-5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
        >
          {saving ? 'Setting live…' : '→ Set Live'}
        </button>
      )}

      {round.status === 'live' && (
        <button
          onClick={handleLock}
          disabled={saving}
          className="min-h-[48px] px-5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
        >
          {saving ? 'Locking…' : '🔒 Lock Round'}
        </button>
      )}

      {round.status === 'locked' && (
        <span className="text-sm text-gray-500 font-medium">🔒 Locked</span>
      )}
    </div>
  );
}

// ── Public component — split into two parallel tracks ────────────────────────

interface LiveControlProps {
  events: EventDoc[];
}

function TrackSection({
  title,
  rounds,
  eventMap,
}: {
  title: string;
  rounds: RoundDoc[];
  eventMap: Map<string, string>;
}) {
  return (
    <div className="flex-1 min-w-[280px]">
      <h3 className="text-base font-semibold text-gray-800 mb-3 sticky top-0 bg-gray-50 py-1">
        {title}
      </h3>
      {rounds.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No rounds in this track.</p>
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

export function LiveControl({ events }: LiveControlProps) {
  const rounds = useRounds(); // no judgeId → all rounds, sorted by scheduledOrder

  const eventMap = new Map(events.map((e) => [e.id, e.name]));
  const locationById = new Map(events.map((e) => [e.id, e.location]));

  if (rounds.length === 0) {
    return <p className="text-gray-500 text-sm py-4">No rounds created yet.</p>;
  }

  const onStageRounds = rounds.filter((r) => locationById.get(r.eventId) === 'onstage');
  const offStageRounds = rounds.filter((r) => locationById.get(r.eventId) === 'offstage');

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <TrackSection title="🎤 On Stage" rounds={onStageRounds} eventMap={eventMap} />
      <TrackSection title="📋 Off Stage" rounds={offStageRounds} eventMap={eventMap} />
    </div>
  );
}