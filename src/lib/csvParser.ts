import Papa from 'papaparse';
import type { ParseResult, ParseError, ParticipantDoc, Group } from '../types';

const VALID_GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];
const VALID_GROUP_SET = new Set<string>(VALID_GROUPS);

const VALID_GENDERS = ['M', 'F'] as const;
const VALID_GENDER_SET = new Set<string>(VALID_GENDERS);

function isValidChestNo(value: string): boolean {
  // Must be a positive integer string — no decimals, no leading zeros that produce 0, parseInt > 0
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const parsed = parseInt(trimmed, 10);
  return parsed > 0;
}

export function parseParticipantCsv(csvText: string): ParseResult {
  const participants: ParticipantDoc[] = [];
  const errors: ParseError[] = [];

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const seenChestNos = new Set<string>();

  result.data.forEach((row, index) => {
    // Row numbers are 1-indexed (row 1 = first data row after header)
    const rowNum = index + 1;
    let rowValid = true;

    const chestNo = row['chestNo']?.trim() ?? '';
    const name = row['name']?.trim() ?? '';
    const group = row['group']?.trim() ?? '';
    const genderRaw = row['gender']?.trim().toUpperCase() ?? '';

    // Validate required fields — check for missing/empty values first
    if (!chestNo) {
      errors.push({ row: rowNum, field: 'chestNo', message: `Row ${rowNum}: missing required field 'chestNo'` });
      rowValid = false;
    }

    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: `Row ${rowNum}: missing required field 'name'` });
      rowValid = false;
    }

    if (!group) {
      errors.push({ row: rowNum, field: 'group', message: `Row ${rowNum}: missing required field 'group'` });
      rowValid = false;
    }

    if (!genderRaw) {
      errors.push({ row: rowNum, field: 'gender', message: `Row ${rowNum}: missing required field 'gender'` });
      rowValid = false;
    }

    // Validate chestNo is a positive integer (only if it was present)
    if (chestNo && !isValidChestNo(chestNo)) {
      errors.push({
        row: rowNum,
        field: 'chestNo',
        message: `Row ${rowNum}: 'chestNo' must be a positive integer, got '${chestNo}'`,
      });
      rowValid = false;
    }

    // Validate group value (only if it was present)
    if (group && !VALID_GROUP_SET.has(group)) {
      errors.push({
        row: rowNum,
        field: 'group',
        message: `Row ${rowNum}: 'group' must be one of ${VALID_GROUPS.map(g => `'${g}'`).join(', ')}, got '${group}'`,
      });
      rowValid = false;
    }

    // Validate gender value (only if it was present)
    if (genderRaw && !VALID_GENDER_SET.has(genderRaw)) {
      errors.push({
        row: rowNum,
        field: 'gender',
        message: `Row ${rowNum}: 'gender' must be 'M' or 'F', got '${genderRaw}'`,
      });
      rowValid = false;
    }

    // Detect duplicate chestNo (only if it was present and passed format validation)
    if (chestNo && isValidChestNo(chestNo)) {
      const normalised = chestNo.trim();
      if (seenChestNos.has(normalised)) {
        errors.push({
          row: rowNum,
          field: 'chestNo',
          message: `Row ${rowNum}: duplicate chest number '${normalised}'`,
        });
        rowValid = false;
      } else {
        seenChestNos.add(normalised);
      }
    }

    if (rowValid) {
      participants.push({
        chestNo: chestNo.trim(),
        name,
        group: group as Group,
        gender: genderRaw as 'M' | 'F',
      });
    }
  });

  return { participants, errors };
}