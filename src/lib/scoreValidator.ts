/**
 * Validates a score value against a given range.
 *
 * @param value - The score to validate
 * @param min - The minimum allowed score (inclusive)
 * @param max - The maximum allowed score (inclusive)
 * @returns An error message string if invalid, or null if valid
 */
export function validateScore(value: number, min: number, max: number): string | null {
  if (!isFinite(value)) {
    return 'Score must be a valid number';
  }

  if (value < min || value > max) {
    return `Score must be between ${min} and ${max}`;
  }

  return null;
}
