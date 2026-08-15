import { RoundDoc, ScoringType } from '../types';

/**
 * Generates a deterministic document ID for a score entry.
 * Format: `{roundId}_{chestNo}_{judgeId}`
 */
export function scoreDocId(
  roundId: string,
  chestNo: string,
  judgeId: string
): string {
  return `${roundId}_${chestNo}_${judgeId}`;
}

/**
 * Computes a round score from an array of individual scores.
 * - 'averaged': arithmetic mean of all scores (0 for empty array)
 * - 'single': first element of the array (0 for empty array)
 */
export function computeRoundScore(
  scores: number[],
  scoringType: ScoringType
): number {
  if (scores.length === 0) return 0;

  if (scoringType === 'averaged') {
    const sum = scores.reduce((acc, val) => acc + val, 0);
    return sum / scores.length;
  }

  // 'single'
  return scores[0];
}

/**
 * Computes the cumulative total across all per-round scores.
 * Returns 0 for an empty array.
 */
export function computeCumulativeTotal(perRoundScores: number[]): number {
  if (perRoundScores.length === 0) return 0;
  return perRoundScores.reduce((acc, val) => acc + val, 0);
}

/**
 * Filters rounds to only those that are currently live and assigned to the given judge.
 */
export function filterLiveRoundsForJudge(
  rounds: RoundDoc[],
  judgeId: string
): RoundDoc[] {
  return rounds.filter(
    (round) =>
      round.status === 'live' && round.assignedJudgeIds.includes(judgeId)
  );
}
