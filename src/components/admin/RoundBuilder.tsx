'use client';

import { useState, useMemo } from 'react';
import { createRound } from '../../lib/firestore';
import { validateRoundConfig } from '../../lib/roundValidator';
import { parseChestRange } from '../../lib/chestRangeParser';
import type { EventDoc, JudgeDoc, ParticipantDoc, Group, ScoringType } from '../../types';

interface RoundBuilderProps {
  events: EventDoc[];
  judges: JudgeDoc[];
  participants: ParticipantDoc[];
  onSave: () => void;
}

const GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior', 'Common'];

const emptyForm = {
  eventId: '',
  group: '' as Group | '',
  assignedJudgeIds: [] as string[],
  participantChestNos: [] as string[],
  scheduledOrder: 1,
  scoreMin: 0,
  scoreMax: 10,
};

export function RoundBuilder({ events, judges, participants, onSave }: RoundBuilderProps) {
  const [form, setForm] = useState(emptyForm);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);

  // Derive scoringType and batchMode from the selected event
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === form.eventId) ?? null,
    [events, form.eventId],
  );

  const derivedScoringType: ScoringType =
    selectedEvent?.scoringMode === 'singleByGroup' ? 'single' : 'averaged';
  const derivedBatchMode: boolean = selectedEvent?.location === 'offstage';

  // Common events are team events — teams are formed on the spot after the
  // round is saved, not selected from a fixed group's participant list.
  const isTeamEvent = form.group === 'Common';

  // Participants filtered to the selected group
  const filteredParticipants = useMemo(
    () => (form.group ? participants.filter((p) => p.group === form.group) : []),
    [participants, form.group],
  );

  const validChestNos = useMemo(
    () => filteredParticipants.map((p) => p.chestNo),
    [filteredParticipants],
  );

  function getJudgeValidationError(): string | null {
    return validateRoundConfig({
      scoringType: derivedScoringType,
      assignedJudgeIds: form.assignedJudgeIds,
    });
  }

  function handleJudgeToggle(judgeId: string) {
    setForm((prev) => {
      const next = prev.assignedJudgeIds.includes(judgeId)
        ? prev.assignedJudgeIds.filter((id) => id !== judgeId)
        : [...prev.assignedJudgeIds, judgeId];
      return { ...prev, assignedJudgeIds: next };
    });
    setJudgeError(null);
  }

  function handleParticipantToggle(chestNo: string) {
    setForm((prev) => {
      const next = prev.participantChestNos.includes(chestNo)
        ? prev.participantChestNos.filter((c) => c !== chestNo)
        : [...prev.participantChestNos, chestNo];
      return { ...prev, participantChestNos: next };
    });
  }

  function handleGroupChange(group: Group | '') {
    setForm((prev) => ({ ...prev, group, participantChestNos: [] }));
    setRangeInput('');
    setRangeErrors([]);
  }

  function handleEventChange(eventId: string) {
    setForm((prev) => ({ ...prev, eventId, assignedJudgeIds: [] }));
    setJudgeError(null);
  }

  // Expand range input and pre-check matching boxes
  function handleRangeInputChange(value: string) {
    setRangeInput(value);
    if (!value.trim()) {
      setRangeErrors([]);
      return;
    }
    const { chestNos, errors } = parseChestRange(value, validChestNos);
    setRangeErrors(errors);
    // Merge expanded chest nos into current selection (additive; admin can uncheck after)
    setForm((prev) => {
      const merged = Array.from(new Set([...prev.participantChestNos, ...chestNos]));
      return { ...prev, participantChestNos: merged };
    });
  }

  function isFormValid(): boolean {
    if (!form.eventId) return false;
    if (!form.group) return false;
    // Team events don't need chest numbers upfront — teams are formed after
    // the round is created, from the round's own page.
    if (!isTeamEvent && form.participantChestNos.length === 0) return false;
    if (getJudgeValidationError() !== null) return false;
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const judgeValidation = getJudgeValidationError();
    if (judgeValidation) {
      setJudgeError(judgeValidation);
      return;
    }

    if (!isFormValid()) return;

    setLoading(true);
    try {
      await createRound({
        eventId: form.eventId,
        group: form.group as Group,
        scoringType: derivedScoringType,
        batchMode: derivedBatchMode,
        isTeamEvent,
        assignedJudgeIds: form.assignedJudgeIds,
        participantChestNos: form.participantChestNos,
        scheduledOrder: form.scheduledOrder,
        status: 'pending',
        scoreMin: form.scoreMin,
        scoreMax: form.scoreMax,
      });
      setForm(emptyForm);
      setJudgeError(null);
      setRangeInput('');
      setRangeErrors([]);
      onSave();
    } catch {
      setSubmitError('Failed to create round. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Event selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="rb-event" className="text-sm font-medium text-gray-700">
          Event <span aria-hidden="true">*</span>
        </label>
        <select
          id="rb-event"
          value={form.eventId}
          onChange={(e) => handleEventChange(e.target.value)}
          disabled={loading}
          aria-required="true"
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} ({ev.location}, {ev.scoringMode})
            </option>
          ))}
        </select>
        {selectedEvent && (
          <p className="text-xs text-gray-500 mt-1">
            Scoring type: <strong>{derivedScoringType}</strong> · Mode:{' '}
            <strong>{derivedBatchMode ? 'batch (off-stage)' : 'sequential (on-stage)'}</strong>
          </p>
        )}
      </div>

      {/* Group selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="rb-group" className="text-sm font-medium text-gray-700">
          Group <span aria-hidden="true">*</span>
        </label>
        <select
          id="rb-group"
          value={form.group}
          onChange={(e) => handleGroupChange(e.target.value as Group | '')}
          disabled={loading}
          aria-required="true"
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Select a group…</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {isTeamEvent && (
          <p className="text-xs text-amber-600 mt-1">
            Common events are team-based — points earned by a team&apos;s top finishes
            get split across its individual members.
          </p>
        )}
      </div>

      {/* Judge multi-select */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">
          Judges <span aria-hidden="true">*</span>
        </legend>
        {!selectedEvent ? (
          <p className="text-sm text-gray-500">Select an event first.</p>
        ) : judges.length === 0 ? (
          <p className="text-sm text-gray-500">No judges available.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {judges.map((judge) => (
              <label
                key={judge.id}
                className="flex items-center gap-3 min-h-[48px] px-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 select-none"
              >
                <input
                  type="checkbox"
                  checked={form.assignedJudgeIds.includes(judge.id)}
                  onChange={() => handleJudgeToggle(judge.id)}
                  disabled={loading}
                  className="w-5 h-5 accent-blue-600"
                />
                <span className="text-base">{judge.name}</span>
              </label>
            ))}
          </div>
        )}
        {judgeError && (
          <p role="alert" className="text-red-600 text-sm">
            {judgeError}
          </p>
        )}
      </fieldset>

      {/* Participant chest numbers — range input + checkbox list */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">
          Participants {!isTeamEvent && <span aria-hidden="true">*</span>}
        </legend>
        {isTeamEvent ? (
          <p className="text-sm text-gray-500">
            This is a Common (team) event — save the round first, then add teams
            from the round&apos;s page. Members can be any chest number, any group.
          </p>
        ) : !form.group ? (
          <p className="text-sm text-gray-500">Select a group to see participants.</p>
        ) : filteredParticipants.length === 0 ? (
          <p className="text-sm text-gray-500">No participants in this group.</p>
        ) : (
          <>
            {/* Range shorthand input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="rb-range" className="text-xs text-gray-500">
                Quick-select by range (e.g. <code>101-115, 118, 120</code>)
              </label>
              <input
                id="rb-range"
                type="text"
                value={rangeInput}
                onChange={(e) => handleRangeInputChange(e.target.value)}
                placeholder="e.g. 101-115, 118"
                disabled={loading}
                className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {rangeErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">
                  {err}
                </p>
              ))}
            </div>

            {/* Checkbox list — manual adjust after range */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredParticipants.map((p) => (
                <label
                  key={p.chestNo}
                  className="flex items-center gap-3 min-h-[48px] px-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 select-none"
                >
                  <input
                    type="checkbox"
                    checked={form.participantChestNos.includes(p.chestNo)}
                    onChange={() => handleParticipantToggle(p.chestNo)}
                    disabled={loading}
                    className="w-5 h-5 accent-blue-600"
                  />
                  <span className="text-base">
                    #{p.chestNo} — {p.name}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {form.participantChestNos.length} selected
            </p>
          </>
        )}
      </fieldset>

      {/* Scheduled order */}
      <div className="flex flex-col gap-1">
        <label htmlFor="rb-order" className="text-sm font-medium text-gray-700">
          Scheduled order
        </label>
        <input
          id="rb-order"
          type="number"
          min={1}
          value={form.scheduledOrder}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, scheduledOrder: Math.max(1, Number(e.target.value)) }))
          }
          disabled={loading}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-32"
        />
      </div>

      {/* Score min / max */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="rb-scoreMin" className="text-sm font-medium text-gray-700">
            Score min
          </label>
          <input
            id="rb-scoreMin"
            type="number"
            value={form.scoreMin}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, scoreMin: Number(e.target.value) }))
            }
            disabled={loading}
            className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="rb-scoreMax" className="text-sm font-medium text-gray-700">
            Score max
          </label>
          <input
            id="rb-scoreMax"
            type="number"
            value={form.scoreMax}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, scoreMax: Number(e.target.value) }))
            }
            disabled={loading}
            className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {submitError && (
        <p role="alert" className="text-red-600 text-sm">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={!isFormValid() || loading}
        className="min-h-[48px] px-6 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Saving…' : 'Save Round'}
      </button>
    </form>
  );
}