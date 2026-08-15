'use client';

import { useEffect, useState } from 'react';
import {
  getOffStageJudgeAssignments,
  setOffStageJudgeAssignment,
} from '../../lib/firestore';
import type { Group, JudgeDoc, OffStageJudgeAssignmentDoc } from '../../types';

const GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];

interface OffStageJudgeAssignmentsProps {
  judges: JudgeDoc[];
}

export function OffStageJudgeAssignments({ judges }: OffStageJudgeAssignmentsProps) {
  const [assignments, setAssignments] = useState<Record<string, OffStageJudgeAssignmentDoc>>({});
  const [saving, setSaving] = useState<Partial<Record<Group, boolean>>>({});
  const [messages, setMessages] = useState<Partial<Record<Group, string>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOffStageJudgeAssignments()
      .then(setAssignments)
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(group: Group, judgeId: string) {
    setSaving((prev) => ({ ...prev, [group]: true }));
    setMessages((prev) => ({ ...prev, [group]: '' }));
    try {
      await setOffStageJudgeAssignment(group, judgeId);
      setAssignments((prev) => ({
        ...prev,
        [group]: { group, judgeId },
      }));
      setMessages((prev) => ({ ...prev, [group]: 'Saved.' }));
    } catch {
      setMessages((prev) => ({ ...prev, [group]: 'Failed to save.' }));
    } finally {
      setSaving((prev) => ({ ...prev, [group]: false }));
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading assignments…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        For events with <strong>Single by group</strong> scoring mode, assign one judge per
        age group. These assignments are used when auto-generating rounds from a schedule import.
      </p>

      {GROUPS.map((group) => {
        const currentJudgeId = assignments[group]?.judgeId ?? '';
        const isSaving = saving[group] ?? false;
        const msg = messages[group] ?? '';

        return (
          <div key={group} className="flex flex-col gap-1">
            <label
              htmlFor={`osa-${group}`}
              className="text-sm font-medium text-gray-700"
            >
              {group}
            </label>
            <div className="flex items-center gap-3">
              <select
                id={`osa-${group}`}
                value={currentJudgeId}
                onChange={(e) => handleChange(group, e.target.value)}
                disabled={isSaving || judges.length === 0}
                className="flex-1 min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {judges.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              {isSaving && (
                <span className="text-xs text-gray-400">Saving…</span>
              )}
              {!isSaving && msg && (
                <span
                  className={`text-xs ${msg === 'Saved.' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {msg}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {judges.length === 0 && (
        <p className="text-sm text-amber-600">
          No judges found. Add judges via the seed script before assigning them.
        </p>
      )}
    </div>
  );
}
