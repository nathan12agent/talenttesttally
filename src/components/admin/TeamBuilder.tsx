'use client';

import { useState } from 'react';
import { createTeam, updateRoundParticipants } from '../../lib/firestore';
import type { ParticipantDoc, TeamDoc } from '../../types';

interface TeamBuilderProps {
  roundId: string;
  participants: ParticipantDoc[]; // ALL participants, regardless of group — anyone can join
  existingTeams: TeamDoc[];
  onTeamAdded: () => void;
}

/**
 * Lets the admin form ad-hoc teams on the spot for a "Common" (group-agnostic)
 * event round. Each created team's ID gets appended to the round's
 * participantChestNos array, so it slots directly into the existing
 * ScoreSheet/ScoreRow flow as if it were a normal entrant.
 */
export function TeamBuilder({ roundId, participants, existingTeams, onTeamAdded }: TeamBuilderProps) {
  const [teamName, setTeamName] = useState('');
  const [selectedChestNos, setSelectedChestNos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleMember(chestNo: string) {
    setSelectedChestNos((prev) =>
      prev.includes(chestNo) ? prev.filter((c) => c !== chestNo) : [...prev, chestNo],
    );
  }

  async function handleAddTeam() {
    setError('');
    const trimmedName = teamName.trim();

    if (!trimmedName) {
      setError('Team name is required');
      return;
    }
    if (selectedChestNos.length === 0) {
      setError('Select at least one member');
      return;
    }
    const duplicateName = existingTeams.some(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      setError('A team with this name already exists for this round');
      return;
    }

    setSaving(true);
    try {
      const teamId = await createTeam(roundId, trimmedName, selectedChestNos);
      await updateRoundParticipants(roundId, teamId); // appends teamId into participantChestNos
      setTeamName('');
      setSelectedChestNos([]);
      onTeamAdded();
    } catch {
      setError('Failed to create team. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className="text-sm font-semibold text-gray-800">Form Teams (Common Event)</h3>

      {existingTeams.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-500">Teams so far:</p>
          <ul className="flex flex-wrap gap-2">
            {existingTeams.map((t) => (
              <li
                key={t.id}
                className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
              >
                {t.name} ({t.memberChestNos.length})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="team-name" className="text-sm font-medium text-gray-700">
          Team name
        </label>
        <input
          id="team-name"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="e.g. Team A"
          disabled={saving}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">
          Members — any chest number, any group
        </legend>
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          {participants.map((p) => (
            <label
              key={p.chestNo}
              className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 select-none"
            >
              <input
                type="checkbox"
                checked={selectedChestNos.includes(p.chestNo)}
                onChange={() => toggleMember(p.chestNo)}
                disabled={saving}
                className="w-5 h-5 accent-blue-600"
              />
              <span className="text-sm">
                #{p.chestNo} — {p.name} ({p.group})
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}

      <button
        onClick={handleAddTeam}
        disabled={saving}
        className="min-h-[48px] px-6 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 self-start"
      >
        {saving ? 'Adding…' : '+ Add Team'}
      </button>
    </div>
  );
}