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

// ── Score document ID helper ──────────────────────────────────────────────────

export function scoreDocId(roundId: string, chestNo: string, judgeId: string): string {
  return `${roundId}_${chestNo}_${judgeId}`;
}

// ── Participants ──────────────────────────────────────────────────────────────

export async function upsertParticipant(data: ParticipantDoc): Promise<void> {
  const ref = doc(collection(db, 'participants'), data.chestNo);
  await setDoc(ref, data);
}

export async function getParticipantChestNosForGroup(group: Group): Promise<string[]> {
  const q = query(collection(db, 'participants'), where('group', '==', group));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.id); // doc ID = chestNo
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function createEvent(
  name: string,
  location: EventDoc['location'],
  scoringMode?: EventDoc['scoringMode'],
): Promise<string> {
  const resolvedScoringMode: EventDoc['scoringMode'] =
    scoringMode ?? (location === 'onstage' ? 'averaged' : 'singleByGroup');
  const docRef = await addDoc(collection(db, 'events'), {
    name,
    location,
    scoringMode: resolvedScoringMode,
  });
  return docRef.id;
}

// ── Rounds ────────────────────────────────────────────────────────────────────

export async function createRound(data: Omit<RoundDoc, 'id'>): Promise<string> {
  const payload: Omit<RoundDoc, 'id'> = {
    ...data,
    status: data.status ?? 'pending',
  };
  const docRef = await addDoc(collection(db, 'eventRounds'), payload);
  return docRef.id;
}

export async function updateRoundStatus(
  roundId: string,
  status: RoundStatus,
): Promise<void> {
  const ref = doc(collection(db, 'eventRounds'), roundId);
  await updateDoc(ref, { status });
}

export async function refreshRoundParticipants(roundId: string, group: Group): Promise<string[]> {
  const chestNos = await getParticipantChestNosForGroup(group);
  const ref = doc(collection(db, 'eventRounds'), roundId);
  await updateDoc(ref, { participantChestNos: chestNos });
  return chestNos;
}

// ── Judges ────────────────────────────────────────────────────────────────────

export async function getJudgeByPin(pin: string): Promise<JudgeDoc | null> {
  const q = query(collection(db, 'judges'), where('pin', '==', pin));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JudgeDoc, 'id'>) };
}

export async function getJudgeByDeviceToken(token: string): Promise<JudgeDoc | null> {
  const q = query(collection(db, 'judges'), where('deviceLinkToken', '==', token));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JudgeDoc, 'id'>) };
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function setScore(data: Omit<ScoreDoc, 'id'>): Promise<void> {
  const id = scoreDocId(data.roundId, data.chestNo, data.judgeId);
  const ref = doc(collection(db, 'scores'), id);
  await setDoc(ref, { ...data, synced: true });
}

// ── Admin sessions ────────────────────────────────────────────────────────────

export async function setAdminSession(uid: string): Promise<void> {
  const ref = doc(collection(db, 'adminSessions'), uid);
  await setDoc(ref, { uid, createdAt: new Date().toISOString() });
}

// ── Off-stage judge assignments ───────────────────────────────────────────────

export async function getOffStageJudgeAssignments(): Promise<Record<string, OffStageJudgeAssignmentDoc>> {
  const snapshot = await getDocs(collection(db, 'offStageJudgeAssignments'));
  const result: Record<string, OffStageJudgeAssignmentDoc> = {};
  snapshot.docs.forEach((docSnap) => {
    result[docSnap.id] = docSnap.data() as OffStageJudgeAssignmentDoc;
  });
  return result;
}

export async function setOffStageJudgeAssignment(
  group: Group,
  judgeId: string,
): Promise<void> {
  const ref = doc(collection(db, 'offStageJudgeAssignments'), group);
  await setDoc(ref, { group, judgeId });
}

// ── Points config ─────────────────────────────────────────────────────────────

export async function getPointsConfig(
  eventId: string,
): Promise<PointsConfigDoc | null> {
  const ref = doc(collection(db, 'pointsConfig'), eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as PointsConfigDoc;
}

export async function setPointsConfig(
  eventId: string,
  points: { first: number; second: number; third: number },
): Promise<void> {
  const ref = doc(collection(db, 'pointsConfig'), eventId);
  await setDoc(ref, { eventId, ...points });
}

// ── Podium computation ────────────────────────────────────────────────────────

export async function computePodiumOnLock(
  roundId: string,
): Promise<PodiumDoc & { pointsConfigured: boolean }> {
  const roundRef = doc(collection(db, 'eventRounds'), roundId);
  const roundSnap = await getDoc(roundRef);
  if (!roundSnap.exists()) {
    throw new Error(`Round ${roundId} not found`);
  }
  const round = { id: roundSnap.id, ...(roundSnap.data() as Omit<RoundDoc, 'id'>) };

  const scoresQuery = query(collection(db, 'scores'), where('roundId', '==', roundId));
  const scoresSnapshot = await getDocs(scoresQuery);
  const scores = scoresSnapshot.docs.map((d) => d.data() as ScoreDoc);

  const scoresByChestNo = new Map<string, number[]>();
  scores.forEach((s) => {
    if (s.absent) return; // skip absent participants entirely — no podium eligibility
    const list = scoresByChestNo.get(s.chestNo) ?? [];
    list.push(s.score);
    scoresByChestNo.set(s.chestNo, list);
  });

  const finalScores: { chestNo: string; finalScore: number }[] = [];
  scoresByChestNo.forEach((values, chestNo) => {
    const finalScore =
      round.scoringType === 'averaged'
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : values[0];
    finalScores.push({ chestNo, finalScore });
  });

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
    const tiedGroup = [finalScores[i]];
    let j = i + 1;
    while (j < finalScores.length && finalScores[j].finalScore === finalScores[i].finalScore) {
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

  const podiumRef = doc(collection(db, 'podiums'), roundId);
  await setDoc(podiumRef, podium);

  await Promise.all(
    rankings.map(async (r) => {
      const totalsRef = doc(collection(db, 'chestNoPointsTotals'), r.chestNo);
      const totalsSnap = await getDoc(totalsRef);
      const existing = totalsSnap.exists()
        ? (totalsSnap.data() as ChestNoPointsTotalsDoc)
        : { chestNo: r.chestNo, perGroupPoints: {}, overallPoints: 0 };

      const updatedPerGroup = {
        ...existing.perGroupPoints,
        [round.group]: (existing.perGroupPoints[round.group] ?? 0) + r.pointsAwarded,
      };

      await setDoc(totalsRef, {
        chestNo: r.chestNo,
        perGroupPoints: updatedPerGroup,
        overallPoints: existing.overallPoints + r.pointsAwarded,
      });
    }),
  );

  return { ...podium, pointsConfigured };
}

export async function getPodiumsForEvent(eventId: string): Promise<PodiumDoc[]> {
  const q = query(collection(db, 'podiums'), where('eventId', '==', eventId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as PodiumDoc);
}

export async function getChestNoPointsTotals(): Promise<ChestNoPointsTotalsDoc[]> {
  const snapshot = await getDocs(collection(db, 'chestNoPointsTotals'));
  return snapshot.docs.map((d) => d.data() as ChestNoPointsTotalsDoc);
}