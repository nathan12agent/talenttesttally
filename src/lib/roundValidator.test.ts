import { validateRoundConfig } from './roundValidator';

describe('validateRoundConfig', () => {
  describe('averaged scoring type', () => {
    it('returns error when no judges assigned', () => {
      expect(validateRoundConfig({ scoringType: 'averaged', assignedJudgeIds: [] }))
        .toBe('Averaged rounds require at least 2 judges');
    });

    it('returns error when only 1 judge assigned', () => {
      expect(validateRoundConfig({ scoringType: 'averaged', assignedJudgeIds: ['judge1'] }))
        .toBe('Averaged rounds require at least 2 judges');
    });

    it('returns null when 2 judges assigned', () => {
      expect(validateRoundConfig({ scoringType: 'averaged', assignedJudgeIds: ['j1', 'j2'] }))
        .toBeNull();
    });

    it('returns null when more than 2 judges assigned', () => {
      expect(validateRoundConfig({ scoringType: 'averaged', assignedJudgeIds: ['j1', 'j2', 'j3'] }))
        .toBeNull();
    });
  });

  describe('single scoring type', () => {
    it('returns error when no judges assigned', () => {
      expect(validateRoundConfig({ scoringType: 'single', assignedJudgeIds: [] }))
        .toBe('Single-judge rounds require exactly 1 judge');
    });

    it('returns null when exactly 1 judge assigned', () => {
      expect(validateRoundConfig({ scoringType: 'single', assignedJudgeIds: ['judge1'] }))
        .toBeNull();
    });

    it('returns error when more than 1 judge assigned', () => {
      expect(validateRoundConfig({ scoringType: 'single', assignedJudgeIds: ['j1', 'j2'] }))
        .toBe('Single-judge rounds require exactly 1 judge');
    });
  });
});
