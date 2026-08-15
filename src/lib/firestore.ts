import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ParticipantDoc,
  EventDoc,
  RoundDoc,
  RoundStatus,
  JudgeDoc,
  ScoreDoc,
  Group,
  OffStageJudgeAssignmentDoc,
  PointsConfigDoc,
  PodiumDoc,
  PodiumRanking,
  ChestNoPointsTotalsDoc,
} from '../types';

// ── Collection references ─────────────────────────────────────────────────────

export const participantsCol = collection(db, 'participants');
export const eventsCol = collection(db, 'events');
export const roundsCol = collection(db, 'eventRounds');
export const judgesCol = collection(db, 'judges');
export const scoresCol = collection(db, 'scores');
export const adminSessionsCol = collection(db, 'adminSessions');
export const offStageJudgeAssignmentsCol = collection(db, 'offStageJudgeAssignments');
export const pointsConfigCol = collection(db, 'pointsConfig');
export const podiumsCol = collection(db, 'podiums');
export const chestNoPointsTotalsCol = collection(db, 'chestNoPointsTotals');

// ── Score document ID helper ──────────────────────────────────────────────────

export function scoreDocId(roundId: string, chestNo: string, judgeId: string): string {
  return `${roundId}_${chestNo}_${judgeId}`;
}

// ── Participants ──────────────────────────────────────────────────────────────

/**
 * Upsert a participant document. The document ID is set to the participant's
 * chestNo so that repeated imports are idempotent.
 */
export async function upsertParticipant(data: ParticipantDoc): Promise<void> {
  const ref = doc(participantsCol, data.chestNo);
  await setDoc(ref, data);
}

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Create a new event document with an auto-generated ID.
 * `scoringMode` defaults based on `location` (onstage → averaged, offstage →
 * singleByGroup) but can be overridden per event — this is how an event like
 * Bible Quiz gets flagged as onstage + singleByGroup.
 * Returns the new document ID.
 */
export async function createEvent(
  name: string,
  location: EventDoc['location'],
  scoringMode?: EventDoc['scoringMode'],
): Promise<string> {
  const resolvedScoringMode: EventDoc['scoringMode'] =
    scoringMode ?? (location === 'onstage' ? 'averaged' : 'singleByGroup');
  const docRef = await addDoc(eventsCol, {
    name,
    location,
    scoringMode: resolvedScoringMode,
  });
  return docRef.id;
}

// ── Rounds ────────────────────────────────────────────────────────────────────

/**
 * Create a new round document. The `id` field is omitted from the input and
 * assigned by Firestore. Defaults `status` to `'pending'` if not provided.
 * Returns the new document ID.
 */
export async function createRound(data: Omit<RoundDoc, 'id'>): Promise<string> {
  const payload: Omit<RoundDoc, 'id'> = {
    ...data,
    status: data.status ?? 'pending',
  };
  const docRef = await addDoc(roundsCol, payload);
  return docRef.id;
}

/**
 * Update the status field of an existing round document.
 */
export async function updateRoundStatus(
  roundId: string,
  status: RoundStatus,
): Promise<void> {
  const ref = doc(roundsCol, roundId);
  await updateDoc(ref, { status });
}

// ── Judges ────────────────────────────────────────────────────────────────────

/**
 * Look up a judge by their PIN. Returns the first matching judge document, or
 * null if no match is found. Writes to the judges collection are performed by
 * the admin seed script only.
 */
export async function getJudgeByPin(pin: string): Promise<JudgeDoc | null> {
  const q = query(judgesCol, where('pin', '==', pin));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JudgeDoc, 'id'>) };
}

/**
 * Look up a judge by their deviceLinkToken (from the QR/link onboarding
 * flow). Returns null if no match.
 */
export async function getJudgeByDeviceToken(token: string): Promise<JudgeDoc | null> {
  const q = query(judgesCol, where('deviceLinkToken', '==', token));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JudgeDoc, 'id'>) };
}

// ── Scores ────────────────────────────────────────────────────────────────────

/**
 * Write a score document using the composite key `{roundId}_{chestNo}_{judgeId}`.
 * Using setDoc makes the write idempotent so offline retries never create
 * duplicates. `synced` is always set to `true` on write.
 */
export async function setScore(data: Omit<ScoreDoc, 'id'>): Promise<void> {
  const id = scoreDocId(data.roundId, data.chestNo, data.judgeId);
  const ref = doc(scoresCol, id);
  await setDoc(ref, { ...data, synced: true });
}

// ── Admin sessions ────────────────────────────────────────────────────────────

/**
 * Record an admin session for the given anonymous UID. The document ID equals
 * the UID so that Firestore security rules can check `exists(…/adminSessions/{uid})`.
 */
export async function setAdminSession(uid: string): Promise<void> {
  const ref = doc(adminSessionsCol, uid);
  await setDoc(ref, { uid, createdAt: new Date().toISOString() });
}

// ── Off-stage judge assignments ─────────────────────────────────────────────
//
// One doc per group (document ID = group name), set once by the admin.
// Rounds with scoringMode 'singleByGroup' look up the responsible judge here
// instead of the admin picking a judge per round.

/**
 * Fetch all off-stage judge assignments (one per group). Returns a map keyed
 * by group for convenient lookup.
 */
export async function getOffStageJudgeAssignments(): Promise<
  Record<string, OffStageJudgeAssignmentDoc>
> {
  const snapshot = await getDocs(offStageJudgeAssignmentsCol);
  const result: Record<string, OffStageJudgeAssignmentDoc> = {};
  snapshot.docs.forEach((docSnap) => {
    result[docSnap.id] = docSnap.data() as OffStageJudgeAssignmentDoc;
  });
  return result;
}

/**
 * Set (or overwrite) which judge is responsible for a group's
 * 'singleByGroup' scoring. Document ID = group name, so this is idempotent.
 */
export async function setOffStageJudgeAssignment(
  group: Group,
  judgeId: string,
): Promise<void> {
  const ref = doc(offStageJudgeAssignmentsCol, group);
  await setDoc(ref, { group, judgeId });
}

// ── Points config ────────────────────────────────────────────────────────────
//
// Custom podium points per event. No fixed scheme is assumed — the admin
// enters these per event, any time before or as results are locked.

/**
 * Fetch the points config for a single event. Returns null if not yet set —
 * callers should treat this as "not configured" rather than defaulting to 0
 * silently, so the admin UI can warn appropriately.
 */
export async function getPointsConfig(
  eventId: string,
): Promise<PointsConfigDoc | null> {
  const ref = doc(pointsConfigCol, eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as PointsConfigDoc;
}

/**
 * Set (or update) the podium points for an event. Document ID = eventId.
 */
export async function setPointsConfig(
  eventId: string,
  points: { first: number; second: number; third: number },
): Promise<void> {
  const ref = doc(pointsConfigCol, eventId);
  await setDoc(ref, { eventId, ...points });
}

// ── Podium computation ───────────────────────────────────────────────────────

/**
 * Compute the podium (top 3) for a round, based on its current scores, and
 * award points from that round's event's points config. Intended to be
 * called immediately after a round's status is set to 'locked'.
 *
 * - For 'average' rounds: final score per chest no. is the mean across all
 *   scores submitted for that chest no. in this round.
 * - For 'single' rounds: final score is simply the (single) judge's score.
 * - Ties within the top 3 are NOT silently resolved: tied chest numbers
 *   share the same rank and receive the same points as each other for that
 *   rank, and `hasTie` is set to true so the admin UI can surface a warning
 *   for manual review.
 * - If no points config exists for the round's event, points are recorded
 *   as 0 and the caller (UI layer) is expected to warn the admin — this
 *   function does not throw in that case, so locking is never blocked.
 *
 * Returns the computed PodiumDoc so the caller can immediately show a
 * warning banner if `hasTie` is true or if points config was missing.
 */
export async function computePodiumOnLock(
  roundId: string,
): Promise<PodiumDoc & { pointsConfigured: boolean }> {
  const roundRef = doc(roundsCol, roundId);
  const roundSnap = await getDoc(roundRef);
  if (!roundSnap.exists()) {
    throw new Error(`Round ${roundId} not found`);
  }
  const round = { id: roundSnap.id, ...(roundSnap.data() as Omit<RoundDoc, 'id'>) };

  // Gather all scores for this round.
  const scoresQuery = query(scoresCol, where('roundId', '==', roundId));
  const scoresSnapshot = await getDocs(scoresQuery);
  const scores = scoresSnapshot.docs.map(
    (d) => d.data() as ScoreDoc,
  );

  // Compute final score per chest no.
  const scoresByChestNo = new Map<string, number[]>();
  scores.forEach((s) => {
    const list = scoresByChestNo.get(s.chestNo) ?? [];
    list.push(s.score);
    scoresByChestNo.set(s.chestNo, list);
  });

  const finalScores: { chestNo: string; finalScore: number }[] = [];
  scoresByChestNo.forEach((values, chestNo) => {
    const finalScore =
      round.scoringType === 'averaged'
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : values[0]; // 'single' — only one judge submits, so values has length 1
    finalScores.push({ chestNo, finalScore });
  });

  // Rank descending by score, take top 3, sharing rank on ties.
  finalScores.sort((a, b) => b.finalScore - a.finalScore);

  const pointsConfig = await getPointsConfig(round.eventId);
  const pointsConfigured = pointsConfig !== null;
  const pointsByRank: Record<1 | 2 | 3, number> = {
    1: pointsConfig?.first ?? 0,
    2: pointsConfig?.second ?? 0,
    3: pointsConfig?.third ?? 0,
  };

  const rankings: PodiumRanking[] = [];
  let hasTie = false;
  let rank: 1 | 2 | 3 = 1;
  let i = 0;
  while (i < finalScores.length && rank <= 3) {
    // Find all entries tied with finalScores[i] at this position.
    const tiedGroup = [finalScores[i]];
    let j = i + 1;
    while (
      j < finalScores.length &&
      finalScores[j].finalScore === finalScores[i].finalScore
    ) {
      tiedGroup.push(finalScores[j]);
      j += 1;
    }
    if (tiedGroup.length > 1) hasTie = true;

    tiedGroup.forEach((entry) => {
      if (rank <= 3) {
        rankings.push({
          chestNo: entry.chestNo,
          finalScore: entry.finalScore,
          rank,
          pointsAwarded: pointsByRank[rank],
        });
      }
    });

    i = j;
    rank = (rank + 1) as 1 | 2 | 3;
  }

  const podium: PodiumDoc = {
    id: roundId,
    eventId: round.eventId,
    group: round.group,
    rankings,
    computedAt: new Date().toISOString(),
    hasTie,
  };

  const podiumRef = doc(podiumsCol, roundId);
  await setDoc(podiumRef, podium);

  // Increment running point totals for each podium finisher.
  await Promise.all(
    rankings.map(async (r) => {
      const totalsRef = doc(chestNoPointsTotalsCol, r.chestNo);
      const totalsSnap = await getDoc(totalsRef);
      const existing = totalsSnap.exists()
        ? (totalsSnap.data() as ChestNoPointsTotalsDoc)
        : {
            chestNo: r.chestNo,
            perGroupPoints: {},
            overallPoints: 0,
          };

      const updatedPerGroup = {
        ...existing.perGroupPoints,
        [round.group]: (existing.perGroupPoints[round.group] ?? 0) + r.pointsAwarded,
      };

      const updated: ChestNoPointsTotalsDoc = {
        chestNo: r.chestNo,
        perGroupPoints: updatedPerGroup,
        overallPoints: existing.overallPoints + r.pointsAwarded,
      };

      await setDoc(totalsRef, updated);
    }),
  );

  return { ...podium, pointsConfigured };
}

/**
 * Fetch all podiums belonging to a given event (across its rounds/groups).
 * Used by the results and points dashboards.
 */
export async function getPodiumsForEvent(eventId: string): Promise<PodiumDoc[]> {
  const q = query(podiumsCol, where('eventId', '==', eventId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as PodiumDoc);
}

/**
 * Fetch running point totals for every chest no. that has scored a podium
 * finish so far. Sort client-side by `overallPoints` or by
 * `perGroupPoints[group]` depending on which leaderboard view is active.
 */
export async function getChestNoPointsTotals(): Promise<ChestNoPointsTotalsDoc[]> {
  const snapshot = await getDocs(chestNoPointsTotalsCol);
  return snapshot.docs.map((d) => d.data() as ChestNoPointsTotalsDoc);
}