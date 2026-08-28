import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * One-off fix: re-syncs participantChestNos on every existing eventRounds
 * doc from the current participants collection (by group + gender). Use
 * this when rounds were created/went live before participants were fully
 * imported, OR to repair rounds that were wrongly populated with the
 * whole group instead of just one gender (e.g. Solo Song Male/Female).
 *
 * For each round, gender is resolved as:
 *   1. round.gender if already set, else
 *   2. inferred from its event's name — "(Male)" / "(Female)" — else
 *   3. undefined (round keeps the whole group, e.g. Action Song)
 * The resolved gender is also written back onto the round doc so future
 * "Refresh participants" / "Set live" actions in the app stay split correctly.
 *
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON key path.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfillRoundParticipants.ts
 */

function inferGenderFromEventName(eventName: string): 'M' | 'F' | undefined {
  if (/\(male\)/i.test(eventName)) return 'M';
  if (/\(female\)/i.test(eventName)) return 'F';
  return undefined;
}

(async () => {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  const participantsSnap = await db.collection('participants').get();
  // chestNosByGroup['Sub Jr']['M'] / ['F'] / ['all']
  const chestNosByGroup: Record<string, Record<'M' | 'F' | 'all', string[]>> = {};
  participantsSnap.docs.forEach((doc) => {
    const group = doc.data().group as string;
    const gender = doc.data().gender as 'M' | 'F';
    chestNosByGroup[group] ??= { M: [], F: [], all: [] };
    chestNosByGroup[group][gender]?.push(doc.id);
    chestNosByGroup[group].all.push(doc.id);
  });

  console.log('Participants found by group:');
  for (const [group, byGender] of Object.entries(chestNosByGroup)) {
    console.log(`  ${group}: ${byGender.all.length} (M: ${byGender.M.length}, F: ${byGender.F.length})`);
  }

  const eventsSnap = await db.collection('events').get();
  const eventGenderById = new Map<string, 'M' | 'F' | undefined>();
  eventsSnap.docs.forEach((doc) => {
    eventGenderById.set(doc.id, inferGenderFromEventName(doc.data().name as string));
  });

  const roundsSnap = await db.collection('eventRounds').get();
  let updated = 0;

  for (const roundDoc of roundsSnap.docs) {
    const round = roundDoc.data();
    if (round.isTeamEvent) {
      console.log(`Round ${roundDoc.id} (${round.group}): skipped — team event`);
      continue;
    }

    const gender: 'M' | 'F' | undefined = round.gender ?? eventGenderById.get(round.eventId);
    const byGender = chestNosByGroup[round.group] ?? { M: [], F: [], all: [] };
    const chestNos = gender ? byGender[gender] : byGender.all;

    await roundDoc.ref.update({
      participantChestNos: chestNos,
      ...(gender ? { gender } : {}),
    });
    console.log(
      `Round ${roundDoc.id} (${round.group}${gender ? `, ${gender}` : ''}): ${chestNos.length} participants synced`,
    );
    updated++;
  }

  console.log(`\nDone. Updated ${updated} round(s).`);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});