import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * One-off fix: re-syncs participantChestNos on every existing eventRounds
 * doc from the current participants collection (by group). Use this when
 * rounds were created/went live before participants were fully imported.
 *
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON key path.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfillRoundParticipants.ts
 */

(async () => {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  const participantsSnap = await db.collection('participants').get();
  const chestNosByGroup: Record<string, string[]> = {};
  participantsSnap.docs.forEach((doc) => {
    const group = doc.data().group as string;
    (chestNosByGroup[group] ??= []).push(doc.id);
  });

  console.log('Participants found by group:');
  for (const [group, chestNos] of Object.entries(chestNosByGroup)) {
    console.log(`  ${group}: ${chestNos.length}`);
  }

  const roundsSnap = await db.collection('eventRounds').get();
  let updated = 0;

  for (const roundDoc of roundsSnap.docs) {
    const round = roundDoc.data();
    const chestNos = chestNosByGroup[round.group] ?? [];
    await roundDoc.ref.update({ participantChestNos: chestNos });
    console.log(`Round ${roundDoc.id} (${round.group}): ${chestNos.length} participants synced`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} round(s).`);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});