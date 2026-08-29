import type { ParticipantDoc, RoundDoc, ScoreDoc, Group, ChestNoPointsTotalsDoc } from '../types';
import { computeRoundScore, computeCumulativeTotal } from './scoring';

/**
 * Returns the column header label for a given round — the event's name,
 * plus the round's gender split (if any) so "Solo Song (Male)" and
 * "Solo Song (Female)" don't collapse into one column.
 */
export function getRoundLabel(round: RoundDoc, eventNameById: Map<string, string>): string {
  const eventName = eventNameById.get(round.eventId) ?? 'Untitled Event';
  return round.gender ? `${eventName} (${round.gender})` : eventName;
}

const escapeCsv = (value: string | number): string => {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Fixed roster groups. 'Common' (team events) is excluded from per-group
// standings sections because it has no fixed participant roster — its
// points already reach individuals via the Podium/Points Tally export.
const ROSTER_GROUPS: Group[] = ['Sub Jr', 'Jr', 'Intermediate', 'Senior'];

/**
 * Builds one group's section: a title line, header row, and one row per
 * participant in that group, columns limited to rounds belonging to that
 * group. Returns '' if the group has no locked rounds or no participants.
 */
function buildGroupSection(
  sectionGroup: Group,
  participants: ParticipantDoc[],
  lockedRounds: RoundDoc[],
  scores: ScoreDoc[],
  eventNameById: Map<string, string>,
): string {
  const relevantRounds = lockedRounds
    .filter((r) => r.group === sectionGroup)
    .sort((a, b) => a.scheduledOrder - b.scheduledOrder);
  if (relevantRounds.length === 0) return '';

  const sectionParticipants = participants.filter((p) => p.group === sectionGroup);
  if (sectionParticipants.length === 0) return '';

  const roundHeaders = relevantRounds.map((r) => getRoundLabel(r, eventNameById));
  const header = ['chestNo', 'name', 'group', ...roundHeaders, 'total'].join(',');

  const rows = sectionParticipants.map((participant) => {
    const perRoundScores = relevantRounds.map((round) => {
      const roundScoreDocs = scores.filter(
        (s) => s.roundId === round.id && s.chestNo === participant.chestNo,
      );
      const scoreValues = roundScoreDocs.map((s) => s.score);
      return computeRoundScore(scoreValues, round.scoringType);
    });

    const total = computeCumulativeTotal(perRoundScores);

    const cells = [
      escapeCsv(participant.chestNo),
      escapeCsv(participant.name),
      escapeCsv(participant.group),
      ...perRoundScores.map(escapeCsv),
      escapeCsv(total),
    ];

    return cells.join(',');
  });

  return [`== ${sectionGroup} ==`, header, ...rows].join('\n');
}

/**
 * Builds a CSV string of competition results.
 *
 * - Only locked rounds are included as score columns.
 * - If groupFilter is a specific group, returns a single table scoped to
 *   that group's rounds and participants (no title line — the file is
 *   already scoped to one group).
 * - If groupFilter is 'all', returns separate sections (one per roster
 *   group), each with its own title line and only the rounds relevant to
 *   that group — avoids one sparse table full of blank cells for rounds
 *   that don't apply to most participants.
 * - Returns an empty string when there's nothing to export.
 */
export function buildResultsCsv(
  participants: ParticipantDoc[],
  rounds: RoundDoc[],
  scores: ScoreDoc[],
  groupFilter: Group | 'all',
  eventNameById: Map<string, string>,
): string {
  const lockedRounds = rounds.filter((r) => r.status === 'locked');

  if (groupFilter !== 'all') {
    const section = buildGroupSection(groupFilter, participants, lockedRounds, scores, eventNameById);
    if (!section) return '';
    // Drop the leading "== Group ==" title line — redundant for a single-group file.
    return section.split('\n').slice(1).join('\n');
  }

  const sections = ROSTER_GROUPS.map((g) =>
    buildGroupSection(g, participants, lockedRounds, scores, eventNameById),
  ).filter((s) => s.length > 0);

  if (sections.length === 0) return '';
  return sections.join('\n\n');
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