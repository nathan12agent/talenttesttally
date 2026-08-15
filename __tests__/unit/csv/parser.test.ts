import * as fc from 'fast-check';
import { parseParticipantCsv } from '../../../src/lib/csvParser';
import type { Group } from '../../../src/types';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const VALID_GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];

function buildCsv(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) return 'chestNo,name,group\n';
  const header = 'chestNo,name,group';
  const lines = rows.map(r =>
    [r.chestNo ?? '', r.name ?? '', r.group ?? ''].join(',')
  );
  return [header, ...lines].join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Example-based unit tests
// ──────────────────────────────────────────────────────────────────────────────

describe('parseParticipantCsv — unit tests', () => {
  test('returns empty participants and no errors for an empty CSV (header only)', () => {
    const { participants, errors } = parseParticipantCsv('chestNo,name,group\n');
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test('parses a single valid row correctly', () => {
    const csv = buildCsv([{ chestNo: '1', name: 'Alice', group: 'Sub Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(errors).toHaveLength(0);
    expect(participants).toHaveLength(1);
    expect(participants[0]).toEqual({ chestNo: '1', name: 'Alice', group: 'Sub Jr' });
  });

  test('parses all four valid group values', () => {
    const rows = VALID_GROUPS.map((g, i) => ({
      chestNo: String(i + 1),
      name: `Participant ${i + 1}`,
      group: g,
    }));
    const { participants, errors } = parseParticipantCsv(buildCsv(rows));
    expect(errors).toHaveLength(0);
    expect(participants).toHaveLength(4);
    participants.forEach((p, i) => expect(p.group).toBe(VALID_GROUPS[i]));
  });

  test('rejects a row with missing chestNo', () => {
    const csv = buildCsv([{ chestNo: '', name: 'Alice', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'chestNo' });
  });

  test('rejects a row with missing name', () => {
    const csv = buildCsv([{ chestNo: '5', name: '', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'name' });
  });

  test('rejects a row with missing group', () => {
    const csv = buildCsv([{ chestNo: '5', name: 'Bob', group: '' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'group' });
  });

  test('rejects a row with an invalid group value', () => {
    const csv = buildCsv([{ chestNo: '5', name: 'Bob', group: 'Expert' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'group' });
  });

  test('rejects a row with a non-integer chestNo (decimal)', () => {
    const csv = buildCsv([{ chestNo: '1.5', name: 'Bob', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'chestNo' });
  });

  test('rejects a row with a zero chestNo', () => {
    const csv = buildCsv([{ chestNo: '0', name: 'Bob', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'chestNo' });
  });

  test('rejects a row with a negative chestNo', () => {
    const csv = buildCsv([{ chestNo: '-3', name: 'Bob', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'chestNo' });
  });

  test('rejects a row with an alphabetic chestNo', () => {
    const csv = buildCsv([{ chestNo: 'abc', name: 'Bob', group: 'Jr' }]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, field: 'chestNo' });
  });

  test('rejects duplicate chestNo rows and keeps the first occurrence', () => {
    const csv = buildCsv([
      { chestNo: '10', name: 'Alice', group: 'Jr' },
      { chestNo: '10', name: 'Bob', group: 'Senior' },
    ]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(1);
    expect(participants[0].name).toBe('Alice');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 2, field: 'chestNo' });
  });

  test('continues storing valid rows when invalid rows are present', () => {
    const csv = buildCsv([
      { chestNo: '1', name: 'Alice', group: 'Jr' },
      { chestNo: '', name: 'Bad Row', group: 'Jr' },
      { chestNo: '3', name: 'Charlie', group: 'Senior' },
    ]);
    const { participants, errors } = parseParticipantCsv(csv);
    expect(participants).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
  });

  test('row numbers in errors are 1-indexed', () => {
    const csv = buildCsv([
      { chestNo: '1', name: 'Alice', group: 'Jr' },
      { chestNo: '2', name: '', group: 'Jr' },   // row 2
      { chestNo: '3', name: 'Charlie', group: 'Senior' },
    ]);
    const { errors } = parseParticipantCsv(csv);
    expect(errors[0].row).toBe(2);
  });

  test('multiple validation errors can be recorded for the same row', () => {
    const csv = buildCsv([{ chestNo: '', name: '', group: 'BadGroup' }]);
    const { errors } = parseParticipantCsv(csv);
    // chestNo missing, name missing, group invalid
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  test('skips empty lines correctly', () => {
    const csv = 'chestNo,name,group\n1,Alice,Jr\n\n2,Bob,Senior\n';
    const { participants, errors } = parseParticipantCsv(csv);
    expect(errors).toHaveLength(0);
    expect(participants).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Property-Based Tests
// ──────────────────────────────────────────────────────────────────────────────

// Arbitrary for a valid group
const validGroupArb = fc.constantFrom(...VALID_GROUPS);

// Arbitrary for a valid chest number (positive integer as string, 1–999)
const validChestNoArb = fc.integer({ min: 1, max: 999 }).map(String);

// Arbitrary for a non-empty participant name (printable ASCII, no commas/newlines/quotes/leading or trailing spaces)
const participantNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter(
    s =>
      s.trim().length > 0 &&
      s === s.trim() &&                // no leading/trailing whitespace (parser trims names)
      !s.includes(',') &&
      !s.includes('\n') &&
      !s.includes('\r') &&
      !s.includes('"')                 // avoid CSV quoting ambiguity
  );

// Arbitrary for a single valid CSV row object
const validRowArb = fc.record({
  chestNo: validChestNoArb,
  name: participantNameArb,
  group: validGroupArb,
});

// Build a list of valid rows with unique chestNos
const uniqueValidRowsArb = fc
  .array(validRowArb, { minLength: 1, maxLength: 20 })
  .map(rows => {
    const seen = new Set<string>();
    return rows.filter(r => {
      if (seen.has(r.chestNo)) return false;
      seen.add(r.chestNo);
      return true;
    });
  })
  .filter(rows => rows.length > 0);

describe('parseParticipantCsv — property-based tests', () => {
  // Feature: live-judge-scoring-app, Property 1: Valid CSV rows produce correctly shaped participant objects
  test('Property 1: valid rows produce exactly one participant per row with matching field values — Validates: Requirements 1.2', () => {
    fc.assert(
      fc.property(uniqueValidRowsArb, rows => {
        const { participants, errors } = parseParticipantCsv(buildCsv(rows));

        // No errors for fully valid input
        expect(errors).toHaveLength(0);

        // Exactly one participant per input row
        expect(participants).toHaveLength(rows.length);

        // Each participant matches its input row
        rows.forEach((row, i) => {
          expect(participants[i].chestNo).toBe(row.chestNo);
          expect(participants[i].name).toBe(row.name);
          expect(participants[i].group).toBe(row.group);
        });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: live-judge-scoring-app, Property 2: Invalid CSV rows are rejected and excluded from valid output
  test('Property 2: invalid rows appear in errors only and do not appear in valid participants — Validates: Requirements 1.3, 1.4, 1.5', () => {
    // Arbitraries for various invalid row types
    const missingChestNoArb = fc.record({
      chestNo: fc.constant(''),
      name: participantNameArb,
      group: validGroupArb,
    });

    const missingNameArb = fc.record({
      chestNo: validChestNoArb,
      name: fc.constant(''),
      group: validGroupArb,
    });

    const missingGroupArb = fc.record({
      chestNo: validChestNoArb,
      name: participantNameArb,
      group: fc.constant(''),
    });

    const invalidGroupArb = fc.record({
      chestNo: validChestNoArb,
      name: participantNameArb,
      group: fc.string({ minLength: 1, maxLength: 20 }).filter(
        s => !VALID_GROUPS.includes(s as Group) && s.trim().length > 0 && !s.includes(',') && !s.includes('"') && !s.includes('\n') && !s.includes('\r')
      ),
    });

    const invalidChestNoArb = fc.record({
      chestNo: fc.oneof(
        fc.constant('0'),
        fc.constant('-1'),
        fc.constant('1.5'),
        fc.string({ minLength: 1, maxLength: 5 }).filter(
          s => (!/^\d+$/.test(s.trim()) || parseInt(s.trim(), 10) <= 0) && !s.includes('"') && !s.includes(',') && !s.includes('\n')
        )
      ),
      name: participantNameArb,
      group: validGroupArb,
    });

    const invalidRowArb = fc.oneof(
      missingChestNoArb,
      missingNameArb,
      missingGroupArb,
      invalidGroupArb,
      invalidChestNoArb
    );

    fc.assert(
      fc.property(
        // One or more invalid rows mixed with zero or more valid rows
        fc.array(invalidRowArb, { minLength: 1, maxLength: 10 }),
        uniqueValidRowsArb,
        (invalidRows, validRows) => {
          // Combine: valid rows first, then invalid rows (to avoid duplicate chestNo issues)
          const allRows = [...validRows, ...invalidRows];
          const csv = buildCsv(allRows);
          const { participants, errors } = parseParticipantCsv(csv);

          // Every invalid row must appear in errors (at least one error per invalid row index)
          const errorRowNumbers = new Set(errors.map(e => e.row));
          const startOfInvalidRows = validRows.length + 1; // 1-indexed

          for (let i = 0; i < invalidRows.length; i++) {
            const rowNum = startOfInvalidRows + i;
            expect(errorRowNumbers.has(rowNum)).toBe(true);
          }

          // No invalid row should appear in participants
          // An invalid row is identified by being at index >= validRows.length in allRows
          const validChestNos = new Set(validRows.map(r => r.chestNo));
          participants.forEach(p => {
            expect(validChestNos.has(p.chestNo)).toBe(true);
          });

          // All originally valid rows (with valid chestNos) should be in participants
          // (unless their chestNo happens to collide with another valid row — filtered upstream)
          const participantChestNos = new Set(participants.map(p => p.chestNo));
          validRows.forEach(r => {
            expect(participantChestNos.has(r.chestNo)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
