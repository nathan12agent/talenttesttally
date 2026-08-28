import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * One-off fix: sets isTeamEvent: true (and clears participantChestNos) on
 * any existing eventRounds doc where group === 'Common' but isTeamEvent
 * was never set — i.e. rounds created via ScheduleImport.tsx before that
 * flag was added there. Rounds created via RoundBuilder.tsx already have
 * the flag and are left untouched.
 *
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON key path.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfillTeamEventFlag.ts
 */

(async () => {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  const roundsSnap = await db.collection('eventRounds').where('group', '==', 'Common').get();
  let updated = 0;

  for (const roundDoc of roundsSnap.docs) {
    const round = roundDoc.data();

    if (round.isTeamEvent) {
      console.log(`Round ${roundDoc.id}: skipped — already flagged as team event`);
      continue;
    }

    await roundDoc.ref.update({
      isTeamEvent: true,
      participantChestNos: [],
    });
    console.log(`Round ${roundDoc.id}: isTeamEvent set to true, participantChestNos cleared`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} round(s).`);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});