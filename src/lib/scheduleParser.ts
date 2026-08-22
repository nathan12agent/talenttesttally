import Papa from 'papaparse';
import type { Group, ScheduleRow, ScheduleParseResult, ParseError } from '../types';

const VALID_GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];
const VALID_LOCATIONS = ['onstage', 'offstage'] as const;
const VALID_SCORING_MODES = ['averaged', 'singleByGroup'] as const;

const REQUIRED_COLUMNS = ['eventName', 'location', 'group', 'scheduledOrder'] as const;

/**
 * Parses a schedule CSV file into structured ScheduleRow objects.
 *
 * Expected columns: eventName, location, scoringMode (optional), group, scheduledOrder
 *
 * scoringMode defaults based on location:
 *   onstage  → averaged
 *   offstage → singleByGroup
 *
 * Returns valid rows, parse errors, and scheduling conflict warnings
 * (participants appearing in multiple rounds at the same scheduledOrder).
 */
export function parseScheduleCsv(csvText: string): ScheduleParseResult {
  const rows: ScheduleRow[] = [];
  const errors: ParseError[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.data.length === 0) {
    errors.push({ row: 0, field: '', message: 'File is empty or has no data rows.' });
    return { rows, errors, conflicts: [] };
  }

  // Validate required column headers exist
  const headers = Object.keys(parsed.data[0] ?? {});
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      errors.push({
        row: 0,
        field: col,
        message: `Missing required column: "${col}". Found: ${headers.join(', ')}`,
      });
    }
  }
  if (errors.length > 0) {
    return { rows, errors, conflicts: [] };
  }

  parsed.data.forEach((rawRow, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row

    const eventName = rawRow['eventName']?.trim();
    const locationRaw = rawRow['location']?.trim().toLowerCase();
    const scoringModeRaw = rawRow['scoringMode']?.trim();
    const groupRaw = rawRow['group']?.trim();
    const scheduledOrderRaw = rawRow['scheduledOrder']?.trim();

    // eventName
    if (!eventName) {
      errors.push({ row: rowNum, field: 'eventName', message: `Row ${rowNum}: eventName is required.` });
      return;
    }

    // location
    if (!locationRaw || !VALID_LOCATIONS.includes(locationRaw as typeof VALID_LOCATIONS[number])) {
      errors.push({
        row: rowNum,
        field: 'location',
        message: `Row ${rowNum}: location must be one of: ${VALID_LOCATIONS.join(', ')}.`,
      });
      return;
    }
    const location = locationRaw as 'onstage' | 'offstage';

    // scoringMode — optional, defaults from location
    let scoringMode: 'averaged' | 'singleByGroup';
    if (!scoringModeRaw) {
      scoringMode = location === 'onstage' ? 'averaged' : 'singleByGroup';
    } else if (VALID_SCORING_MODES.includes(scoringModeRaw as typeof VALID_SCORING_MODES[number])) {
      scoringMode = scoringModeRaw as 'averaged' | 'singleByGroup';
    } else {
      errors.push({
        row: rowNum,
        field: 'scoringMode',
        message: `Row ${rowNum}: scoringMode must be one of: ${VALID_SCORING_MODES.join(', ')}.`,
      });
      return;
    }

    // group
    if (!groupRaw || !VALID_GROUPS.includes(groupRaw as Group)) {
      errors.push({
        row: rowNum,
        field: 'group',
        message: `Row ${rowNum}: group must be one of: ${VALID_GROUPS.join(', ')}.`,
      });
      return;
    }
    const group = groupRaw as Group;

    // scheduledOrder
    const scheduledOrder = parseInt(scheduledOrderRaw ?? '', 10);
    if (!scheduledOrderRaw || isNaN(scheduledOrder) || scheduledOrder <= 0) {
      errors.push({
        row: rowNum,
        field: 'scheduledOrder',
        message: `Row ${rowNum}: scheduledOrder must be a positive integer.`,
      });
      return;
    }

    rows.push({ eventName, location, scoringMode, group, scheduledOrder });
  });

  // Detect scheduling conflicts: same group assigned to multiple rounds at the same order slot
  const conflicts: string[] = [];
  const orderGroupKey = new Map<string, string[]>();
  rows.forEach((r) => {
    const key = `${r.scheduledOrder}::${r.group}`;
    const existing = orderGroupKey.get(key) ?? [];
    existing.push(r.eventName);
    orderGroupKey.set(key, existing);
  });
  orderGroupKey.forEach((eventNames, key) => {
    if (eventNames.length > 1) {
      const [order, group] = key.split('::');
      conflicts.push(
        `Order ${order}, Group "${group}" appears in multiple events: ${eventNames.join(', ')}`,
      );
    }
  });

  return { rows, errors, conflicts };
}
