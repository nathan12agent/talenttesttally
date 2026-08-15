/**
 * Parses a shorthand chest-number range string into individual chest numbers.
 *
 * Accepted input format (comma-separated tokens):
 *   - Single number: "101"
 *   - Inclusive range: "101-115"
 *   - Mixed: "101-115, 118, 120"
 *
 * Each expanded chest number is validated against the provided set of
 * known/valid chest numbers. Unknown numbers are collected as errors but the
 * parse still succeeds for valid ones.
 */
export interface ChestRangeParseResult {
  chestNos: string[];
  errors: string[];
}

export function parseChestRange(
  input: string,
  validChestNos: string[],
): ChestRangeParseResult {
  const validSet = new Set(validChestNos);
  const expanded: string[] = [];
  const errors: string[] = [];

  if (!input.trim()) {
    return { chestNos: [], errors: [] };
  }

  const tokens = input.split(',').map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-')) {
      // Range token: "101-115"
      const parts = token.split('-');
      if (parts.length !== 2) {
        errors.push(`Invalid range token: "${token}"`);
        continue;
      }
      const start = parseInt(parts[0].trim(), 10);
      const end = parseInt(parts[1].trim(), 10);

      if (isNaN(start) || isNaN(end)) {
        errors.push(`Non-numeric range: "${token}"`);
        continue;
      }
      if (start > end) {
        errors.push(`Range start > end: "${token}"`);
        continue;
      }
      for (let n = start; n <= end; n++) {
        expanded.push(String(n));
      }
    } else {
      // Single number token
      const n = parseInt(token, 10);
      if (isNaN(n)) {
        errors.push(`Non-numeric value: "${token}"`);
        continue;
      }
      expanded.push(String(n));
    }
  }

  // De-duplicate while preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const no of expanded) {
    if (!seen.has(no)) {
      seen.add(no);
      deduped.push(no);
    }
  }

  // Validate against known participants
  const valid: string[] = [];
  for (const no of deduped) {
    if (validSet.has(no)) {
      valid.push(no);
    } else {
      errors.push(`Chest number ${no} not found in participant list`);
    }
  }

  return { chestNos: valid, errors };
}
