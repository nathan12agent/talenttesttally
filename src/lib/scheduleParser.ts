import Papa from 'papaparse';
import type { EventDoc, RoundDoc, Group, ScoringType } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleParseError {
  row: number;
  field: string;
  message: string;
}

export interface ScheduleParseResult {
  events: Omit<EventDoc, 'id'>[];
  rounds: Omit<RoundDoc, 'id' | 'assignedJudgeIds' | 'status'>[];
  errors: ScheduleParseError[];
  /** Chest numbers that appear in more than one round with the same scheduledOrder */
  conflicts: { chestNo: string; rounds: string[] }[];
}

const VALID_GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];
const VALID_LOCATIONS: EventDoc['location'][] = ['onstage', 'offstage'];
const VALID_SCORING_MODES: EventDoc['scoringMode'][] = ['averaged', 'singleByGroup'];

// Flexible header matching — normalise to lowercase, strip spaces/underscores
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

const HEADER_MAP: Record<string, string> = {
  eventname: 'eventName',
  event: 'eventName',
  name: 'eventName',
  location: 'location',
  loc: 'location',
  scoringmode: 'scoringMode',
  scoring: 'scoringMode',
  mode: 'scoringMode',
  group: 'group',
  groups: 'group',
  agegroup: 'group',
  scheduledorder: 'scheduledOrder',
  order: 'scheduledOrder',
  runningorder: 'scheduledOrder',
  timeslot: 'scheduledOrder',
  slot: 'scheduledOrder',
};

/**
 * Parse a schedule CSV into a list of event + round descriptors.
 *
 * CSV columns (flexible header names, see HEADER_MAP):
 *   eventName | location | scoringMode (optional) | group | scheduledOrder
 *
 * One row = one event × one group combination.
 * Multiple rows with the same event name are merged into a single event; the
 * location and scoringMode are taken from the first row for that event name.
 *
 * This function does NOT write to Firestore — the caller (ScheduleImport) does
 * the writes so it can show progress, handle partial failures, etc.
 */
export function parseScheduleCsv(csvText: string): ScheduleParseResult {
  const errors: ScheduleParseError[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => {
      const normalised = normaliseKey(h);
      return HEADER_MAP[normalised] ?? h;
    },
  });

  if (!parsed.data.length) {
    return { events: [], rounds: [], errors: [{ row: 0, field: 'file', message: 'File is empty or has no data rows' }], conflicts: [] };
  }

  const requiredHeaders = ['eventName', 'location', 'group', 'scheduledOrder'];
  const firstRow = parsed.data[0];
  const missingHeaders = requiredHeaders.filter((h) => !(h in firstRow));
  if (missingHeaders.length > 0) {
    return {
      events: [],
      rounds: [],
      errors: [{ row: 0, field: missingHeaders.join(', '), message: `Missing required columns: ${missingHeaders.join(', ')}` }],
      conflicts: [],
    };
  }

  // Collect unique events keyed by normalised name
  const eventMap = new Map<string, Omit<EventDoc, 'id'>>();
  // Collect rounds
  const roundDescriptors: Omit<RoundDoc, 'id' | 'assignedJudgeIds' | 'status'>[] = [];

  for (let rowIdx = 0; rowIdx < parsed.data.length; rowIdx++) {
    const row = parsed.data[rowIdx];
    const rowNum = rowIdx + 2; // 1-indexed, +1 for header row

    const eventName = row['eventName']?.trim();
    const locationRaw = row['location']?.trim().toLowerCase() as EventDoc['location'];
    const scoringModeRaw = row['scoringMode']?.trim() as EventDoc['scoringMode'] | undefined;
    const groupRaw = row['group']?.trim() as Group;
    const orderRaw = row['scheduledOrder']?.trim();

    // Validate required fields
    if (!eventName) {
      errors.push({ row: rowNum, field: 'eventName', message: `Row ${rowNum}: eventName is required` });
      continue;
    }

    if (!locationRaw || !VALID_LOCATIONS.includes(locationRaw)) {
      errors.push({ row: rowNum, field: 'location', message: `Row ${rowNum}: location must be 'onstage' or 'offstage', got "${locationRaw}"` });
      continue;
    }

    if (!groupRaw || !VALID_GROUPS.includes(groupRaw)) {
      errors.push({ row: rowNum, field: 'group', message: `Row ${rowNum}: group must be one of ${VALID_GROUPS.join(', ')}, got "${groupRaw}"` });
      continue;
    }

    const scheduledOrder = parseInt(orderRaw, 10);
    if (!orderRaw || isNaN(scheduledOrder) || scheduledOrder < 1) {
      errors.push({ row: rowNum, field: 'scheduledOrder', message: `Row ${rowNum}: scheduledOrder must be a positive integer` });
      continue;
    }

    // Resolve scoringMode: from column if present and valid, otherwise derive from location
    let scoringMode: EventDoc['scoringMode'];
    if (scoringModeRaw && VALID_SCORING_MODES.includes(scoringModeRaw)) {
      scoringMode = scoringModeRaw;
    } else {
      scoringMode = locationRaw === 'onstage' ? 'averaged' : 'singleByGroup';
    }

    // Derive scoringType and batchMode for round
    const scoringType: ScoringType = scoringMode === 'singleByGroup' ? 'single' : 'averaged';
    const batchMode: boolean = locationRaw === 'offstage';

    // Register event (first occurrence wins for location/scoringMode)
    const normalName = eventName.toLowerCase();
    if (!eventMap.has(normalName)) {
      eventMap.set(normalName, { name: eventName, location: locationRaw, scoringMode });
    }

    roundDescriptors.push({
      eventId: normalName, // placeholder — ScheduleImport replaces with real Firestore ID
      group: groupRaw,
      scoringType,
      batchMode,
      participantChestNos: [],
      scheduledOrder,
      scoreMin: 0,
      scoreMax: 100,
    });
  }

  // ── Conflict detection: same scheduledOrder, same participant in >1 round ──
  // (Participants aren't in the schedule CSV — conflict detection is done
  // post-import when participant lists are assigned. We detect order collisions
  // between rounds of the same track/location here as a proxy.)
  const ordersByEventGroup = new Map<string, number[]>();
  const conflicts: { chestNo: string; rounds: string[] }[] = [];

  // For now we surface order collisions within the same scheduledOrder across rounds
  const orderRoundMap = new Map<number, string[]>();
  for (const r of roundDescriptors) {
    const key = r.scheduledOrder;
    const existing = orderRoundMap.get(key) ?? [];
    existing.push(`${r.eventId}/${r.group}`);
    orderRoundMap.set(key, existing);
  }
  // Expose collisions as "conflicts" using scheduledOrder as the chestNo field for display
  orderRoundMap.forEach((rounds, order) => {
    if (rounds.length > 1) {
      conflicts.push({ chestNo: `order #${order}`, rounds });
    }
  });

  void ordersByEventGroup; // suppress unused warning

  return {
    events: Array.from(eventMap.values()),
    rounds: roundDescriptors,
    errors,
    conflicts,
  };
}
