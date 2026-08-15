import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Seed script: populates Firestore with sample judges, events, rounds, and participants.
 *
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON key file.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed.ts
 */

(async () => {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  // ── Judges ────────────────────────────────────────────────────────────────
  const judgeData = [
    { name: 'Judge Alice', pin: '1001' },
    { name: 'Judge Bob', pin: '1002' },
    { name: 'Judge Carol', pin: '1003' },
  ];

  const judgeIds: string[] = [];
  for (const judge of judgeData) {
    const ref = await db.collection('judges').add(judge);
    judgeIds.push(ref.id);
    console.log(`Created judge: ${ref.id}`);
  }

  // ── Events ────────────────────────────────────────────────────────────────
  const eventData = [
    { name: 'Solo Singing' },
    { name: 'Group Dance' },
    { name: 'Solo Instrumental' },
  ];

  const eventIds: string[] = [];
  for (const event of eventData) {
    const ref = await db.collection('events').add(event);
    eventIds.push(ref.id);
    console.log(`Created event: ${ref.id} (${event.name})`);
  }

  // ── Rounds (1 per event) ──────────────────────────────────────────────────
  for (let i = 0; i < eventIds.length; i++) {
    const round = {
      eventId: eventIds[i],
      group: 'Sub Jr',
      scoringType: 'averaged',
      assignedJudgeIds: judgeIds,
      participantChestNos: ['1', '2', '3'],
      scheduledOrder: i + 1,
      status: 'pending',
      scoreMin: 0,
      scoreMax: 100,
    };
    const ref = await db.collection('eventRounds').add(round);
    console.log(`Created round: ${ref.id}`);
  }

  // ── Participants ──────────────────────────────────────────────────────────
  const participants = [
    { chestNo: '1', name: 'Alice Smith', group: 'Sub Jr' },
    { chestNo: '2', name: 'Bob Jones', group: 'Sub Jr' },
    { chestNo: '3', name: 'Carol White', group: 'Sub Jr' },
    { chestNo: '4', name: 'David Brown', group: 'Jr' },
    { chestNo: '5', name: 'Eva Green', group: 'Intermediate' },
  ];

  for (const participant of participants) {
    await db.collection('participants').doc(participant.chestNo).set(participant);
    console.log(`Created participant: ${participant.chestNo} (${participant.name})`);
  }

  console.log('Seed complete.');
})();
