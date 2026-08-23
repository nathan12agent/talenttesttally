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
  const [memberSearch, setMemberSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleMember(chestNo: string) {
    setSelectedChestNos((prev) =>
      prev.includes(chestNo) ? prev.filter((c) => c !== chestNo) : [...prev, chestNo],
    );
  }

  const filteredCandidates = participants.filter(
    (p) =>
      !selectedChestNos.includes(p.chestNo) &&
      (p.chestNo.includes(memberSearch) ||
        p.name.toLowerCase().includes(memberSearch.toLowerCase())),
  );

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
      setMemberSearch('');
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
          Members — type chest number or name to add
        </legend>

        {/* Already-added members, as removable chips */}
        {selectedChestNos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {selectedChestNos.map((chestNo) => {
              const p = participants.find((pp) => pp.chestNo === chestNo);
              return (
                <span
                  key={chestNo}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                >
                  #{chestNo} {p?.name}
                  <button
                    type="button"
                    onClick={() => toggleMember(chestNo)}
                    disabled={saving}
                    className="ml-1 text-blue-400 hover:text-blue-700 disabled:opacity-50"
                    aria-label={`Remove ${p?.name ?? chestNo}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <input
          type="text"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Type chest number or name…"
          disabled={saving}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />

        {memberSearch && (
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredCandidates.length === 0 ? (
              <p className="text-sm text-gray-400 p-3">No match found.</p>
            ) : (
              filteredCandidates.slice(0, 8).map((p) => (
                <button
                  type="button"
                  key={p.chestNo}
                  onClick={() => {
                    toggleMember(p.chestNo);
                    setMemberSearch('');
                  }}
                  disabled={saving}
                  className="text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                >
                  #{p.chestNo} — {p.name} ({p.group})
                </button>
              ))
            )}
          </div>
        )}
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