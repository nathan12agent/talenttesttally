'use client';
import { useRounds } from '../../hooks/useRounds';
import type { EventDoc, JudgeDoc, RoundDoc, RoundStatus } from '../../types';

interface AdminRoundListProps {
  events: EventDoc[];
  judges: JudgeDoc[];
}

function StatusBadge({ status }: { status: RoundStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Live
      </span>
    );
  }
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        🔒 Locked
      </span>
    );
  }
  // pending
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Pending
    </span>
  );
}

function RoundCard({
  round,
  judges,
}: {
  round: RoundDoc;
  judges: JudgeDoc[];
}) {
  const assignedNames = round.assignedJudgeIds
    .map((id) => judges.find((j) => j.id === id)?.name ?? id)
    .join(', ');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-base font-medium text-gray-900">{round.group}</span>
        <StatusBadge status={round.status} />
      </div>

      <dl className="space-y-1 text-sm text-gray-600">
        <div className="flex gap-1">
          <dt className="font-medium text-gray-700 shrink-0">Scoring:</dt>
          <dd className="capitalize">{round.scoringType}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-gray-700 shrink-0">Judges:</dt>
          <dd>{assignedNames || <span className="italic text-gray-400">None assigned</span>}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-gray-700 shrink-0">Participants:</dt>
          <dd>{round.participantChestNos.length}</dd>
        </div>
      </dl>
    </div>
  );
}

export function AdminRoundList({ events, judges }: AdminRoundListProps) {
  const rounds = useRounds(); // no judgeId → all rounds, ordered by scheduledOrder

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center mt-12">
        No rounds created yet.
      </p>
    );
  }

  // Group rounds by eventId, preserving scheduledOrder within each group
  const grouped = rounds.reduce<Record<string, RoundDoc[]>>((acc, round) => {
    if (!acc[round.eventId]) acc[round.eventId] = [];
    acc[round.eventId].push(round);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([eventId, eventRounds]) => {
        const eventName =
          events.find((e) => e.id === eventId)?.name ?? eventId;

        return (
          <section key={eventId}>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              {eventName}
            </h2>
            {eventRounds.map((round) => (
              <RoundCard key={round.id} round={round} judges={judges} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
