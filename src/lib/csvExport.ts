import type { ParticipantDoc, RoundDoc, ScoreDoc, Group, ChestNoPointsTotalsDoc } from '../types';
import { computeRoundScore, computeCumulativeTotal } from './scoring';

/**
 * Returns the column header label for a given round.
 * Currently uses the round's Firestore document ID.
 */
export function getRoundLabel(round: RoundDoc): string {
  return round.id;
}

/**
 * Builds a CSV string of competition results for the given group filter.
 *
 * - Only locked rounds are included as score columns.
 * - Rounds are sorted by scheduledOrder.
 * - If groupFilter is not 'all', only participants from that group are included.
 * - Returns an empty string when no locked rounds exist for the filtered group.
 *
 * CSV format:
 *   chestNo,name,group,[round columns...],total
 *   <row per participant>
 */
export function buildResultsCsv(
  participants: ParticipantDoc[],
  rounds: RoundDoc[],
  scores: ScoreDoc[],
  groupFilter: Group | 'all'
): string {
  // 1. Filter to locked rounds only, sorted by scheduledOrder
  const lockedRounds = rounds
    .filter((r) => r.status === 'locked')
    .sort((a, b) => a.scheduledOrder - b.scheduledOrder);

  // 2. Filter participants by group
  const filteredParticipants =
    groupFilter === 'all'
      ? participants
      : participants.filter((p) => p.group === groupFilter);

  // 3. Further narrow locked rounds to those relevant to the filtered group
  //    (rounds have a group field — only include rounds for the selected group)
  const relevantRounds =
    groupFilter === 'all'
      ? lockedRounds
      : lockedRounds.filter((r) => r.group === groupFilter);

  // 4. If no locked rounds exist for the filtered group, return empty string
  if (relevantRounds.length === 0) {
    return '';
  }

  // 5. Build header row
  const roundHeaders = relevantRounds.map(getRoundLabel);
  const header = ['chestNo', 'name', 'group', ...roundHeaders, 'total'].join(',');

  // 6. Build one row per participant
  const rows = filteredParticipants.map((participant) => {
    const perRoundScores = relevantRounds.map((round) => {
      // Gather all scores for this participant in this round
      const roundScoreDocs = scores.filter(
        (s) => s.roundId === round.id && s.chestNo === participant.chestNo
      );
      const scoreValues = roundScoreDocs.map((s) => s.score);
      return computeRoundScore(scoreValues, round.scoringType);
    });

    const total = computeCumulativeTotal(perRoundScores);

    // Escape CSV values (wrap in quotes if they contain commas or quotes)
    const escapeCsv = (value: string | number): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const cells = [
      escapeCsv(participant.chestNo),
      escapeCsv(participant.name),
      escapeCsv(participant.group),
      ...perRoundScores.map(escapeCsv),
      escapeCsv(total),
    ];

    return cells.join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Builds a CSV of the running podium/points tally — chest no., name, group,
 * points per group, overall points, sorted by overall points descending.
 * Safe to call at any time; reflects whatever podiums have been computed
 * so far (rounds not yet locked simply haven't contributed points yet).
 */
export function buildPointsTallyCsv(
  participants: ParticipantDoc[],
  totals: ChestNoPointsTotalsDoc[],
  groupFilter: Group | 'all',
): string {
  const totalsByChestNo = new Map(totals.map((t) => [t.chestNo, t]));

  const filteredParticipants =
    groupFilter === 'all' ? participants : participants.filter((p) => p.group === groupFilter);

  if (filteredParticipants.length === 0) return '';

  const escapeCsv = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = filteredParticipants
    .map((p) => {
      const t = totalsByChestNo.get(p.chestNo);
      return {
        chestNo: p.chestNo,
        name: p.name,
        group: p.group,
        groupPoints: t?.perGroupPoints[p.group] ?? 0,
        overallPoints: t?.overallPoints ?? 0,
      };
    })
    .sort((a, b) => b.overallPoints - a.overallPoints);

  const header = ['chestNo', 'name', 'group', 'groupPoints', 'overallPoints'].join(',');
  const body = rows.map((r) =>
    [
      escapeCsv(r.chestNo),
      escapeCsv(r.name),
      escapeCsv(r.group),
      escapeCsv(r.groupPoints),
      escapeCsv(r.overallPoints),
    ].join(','),
  );

  return [header, ...body].join('\n');
}