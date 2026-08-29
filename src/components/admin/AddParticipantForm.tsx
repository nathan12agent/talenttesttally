'use client';
import { useState } from 'react';
import { upsertParticipant } from '../../lib/firestore';
import type { Group } from '../../types';

const GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior' ];

export function AddParticipantForm() {
  const [chestNo, setChestNo] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState<Group>('Sub Jr');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isValidChestNo(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length > 0 && /^[A-Za-z0-9]+$/.test(trimmed);
  }

  async function handleAdd() {
    setError(null);

    const trimmedChestNo = chestNo.trim();
    const trimmedName = name.trim();

    if (!isValidChestNo(trimmedChestNo)) {
      setError("Chest No must be letters/numbers only (no spaces or symbols), e.g. 'sj101'.");
      return;
    }
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    try {
      await upsertParticipant({ chestNo: trimmedChestNo, name: trimmedName, group, gender });
      // Reset for the next entry — chest no/name change each time, group/gender
      // often repeat for a run of on-the-spot registrations, so leave those as-is.
      setChestNo('');
      setName('');
    } catch (err) {
      setError('Failed to add participant. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-700">Add Participant On the Spot</h3>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Chest No (e.g. sj101)"
          value={chestNo}
          onChange={(e) => setChestNo(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
        />
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as Group)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as 'M' | 'F')}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : '+ Add'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}