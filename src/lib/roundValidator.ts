import { RoundDoc, ScoringType } from '../types';

export function validateRoundConfig(
  config: Pick<RoundDoc, 'scoringType' | 'assignedJudgeIds'>
): string | null {
  if (config.scoringType === 'averaged' && config.assignedJudgeIds.length < 2) {
    return 'Averaged rounds require at least 2 judges';
  }

  if (config.scoringType === 'single' && config.assignedJudgeIds.length !== 1) {
    return 'Single-judge rounds require exactly 1 judge';
  }

  return null;
}
