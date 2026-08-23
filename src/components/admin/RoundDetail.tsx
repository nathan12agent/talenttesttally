'use client';

import { useEffect, useState } from 'react';
import { TeamBuilder } from './TeamBuilder';
import { getTeamsForRound } from '../../lib/firestore';
import type { RoundDoc, ParticipantDoc, TeamDoc } from '../../types';

interface RoundDetailProps {
  round: RoundDoc;
  allParticipants: ParticipantDoc[];
}

export function RoundDetail({ round, allParticipants }: RoundDetailProps) {
  const [teams, setTeams] = useState<TeamDoc[]>([]);

  async function refreshTeams() {
    const fetched = await getTeamsForRound(round.id);
    setTeams(fetched);
  }

  useEffect(() => {
  refreshTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [round.id]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{round.group} — Round Details</h2>

      {round.isTeamEvent && (
        <TeamBuilder
          roundId={round.id}
          participants={allParticipants}
          existingTeams={teams}
          onTeamAdded={refreshTeams}
        />
      )}

      {/* rest of your existing round detail UI (live control, lock button, etc.) */}
    </div>
  );
}