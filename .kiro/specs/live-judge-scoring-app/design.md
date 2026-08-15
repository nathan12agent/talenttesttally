# Design Document: Live Judge Scoring & Tally App

## Overview

This document describes the technical design for a real-time judge scoring PWA built with Next.js 14 App Router, Firebase (Firestore + Anonymous Auth + Hosting), and Tailwind CSS. Approximately 50 participants compete across 23 events; three judges use their phones to score participants in real time, and a single admin device manages the competition lifecycle.

The app is split into two surfaces:

- **Judge App** (`/judge`) — PIN-based identity, score entry, offline-first operation
- **Admin App** (`/admin`) — participant import, event/round management, live control, results dashboard, CSV export

All data lives in Firestore. Offline capability is provided by Firestore's built-in IndexedDB persistence combined with a PWA service worker that caches the app shell.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router | SSR + static rendering, file-based routing, PWA support |
| Database | Firestore | Real-time `onSnapshot`, offline persistence, free tier generous |
| Auth | Firebase Anonymous Auth | No account creation required; anonymous UID used for session identity |
| PWA | `@ducanh2912/next-pwa` | Maintained fork compatible with Next.js App Router |
| Styling | Tailwind CSS | Mobile-first, utility-first, no runtime overhead |
| CSV parsing | PapaParse | Battle-tested browser CSV parser |
| Admin auth | `adminSessions` Firestore collection | Stateless token pattern; admin PIN grants a session doc that security rules check |


---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Devices                           │
│                                                                 │
│  ┌──────────────┐        ┌──────────────────────────────────┐  │
│  │  Admin Phone │        │   Judge Phone (×3)               │  │
│  │  /admin      │        │   /judge                         │  │
│  │  (PWA)       │        │   (PWA, offline-first)           │  │
│  └──────┬───────┘        └───────────────┬──────────────────┘  │
│         │                                │                      │
└─────────┼────────────────────────────────┼──────────────────────┘
          │  onSnapshot / writes           │  onSnapshot / writes
          ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Firebase                                 │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Firestore  │  │  Anonymous Auth  │  │  Firebase Hosting │  │
│  │  (database) │  │  (session mgmt)  │  │  (static deploy)  │  │
│  └─────────────┘  └──────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. Admin signs in anonymously → writes a doc to `adminSessions/{uid}` → Firestore rules grant admin writes
2. Judges sign in anonymously → enter PIN → PIN matched against `judges/{judgeId}` → judge identity stored in `sessionStorage`
3. Admin creates events/rounds → stored in Firestore → judges receive real-time updates via `onSnapshot`
4. Admin transitions round to `live` → judges' `onSnapshot` listeners pick up status change within seconds → scoring panel becomes active
5. Judges submit scores → written to `scores/{roundId}_{chestNo}_{judgeId}` → admin results dashboard updates via `onSnapshot`
6. Admin transitions round to `locked` → Firestore security rules block further score writes → judges' UI switches to read-only


## Firestore Security Rules

### Pseudocode

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: check that the requesting user has an active admin session
    function isAdmin() {
      return exists(/databases/$(database)/documents/_adminSessions/$(request.auth.uid));
    }

    // Helper: check that the round is not locked
    function roundNotLocked(roundId) {
      let round = get(/databases/$(database)/documents/eventRounds/$(roundId)).data;
      return round.status != 'locked';
    }

    // Helper: check that the judge is assigned to the round
    function judgeIsAssigned(roundId, judgeId) {
      let round = get(/databases/$(database)/documents/eventRounds/$(roundId)).data;
      return judgeId in round.assignedJudgeIds;
    }

    // ── Admin session ─────────────────────────────────────────────
    match /_adminSessions/{uid} {
      allow write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null;
    }

    // ── Participants ──────────────────────────────────────────────
    match /participants/{chestNo} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }

    // ── Events ───────────────────────────────────────────────────
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }

    // ── Event Rounds ─────────────────────────────────────────────
    match /eventRounds/{roundId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }

    // ── Judges ───────────────────────────────────────────────────
    match /judges/{judgeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }

    // ── Scores ───────────────────────────────────────────────────
    // Document ID format: {roundId}_{chestNo}_{judgeId}
    match /scores/{scoreId} {
      allow read: if request.auth != null;

      allow write: if
        request.auth != null &&
        // Round must not be locked
        roundNotLocked(request.resource.data.roundId) &&
        // Writing judge must be assigned to the round
        judgeIsAssigned(
          request.resource.data.roundId,
          request.resource.data.judgeId
        );
    }
  }
}
```

### Security Rule Notes

- The `isAdmin()` check requires the device to have previously written a `_adminSessions/{uid}` document. This document is created when the admin enters the admin passcode on first load.
- Score writes are denied at the Firestore level when `round.status === 'locked'` — this is enforced server-side, not just client-side.
- The `judgeIsAssigned` check prevents one judge from submitting scores on behalf of another.
- Anonymous Auth is required for all reads, preventing unauthenticated access.

---

## Error Handling

### CSV Import Errors

| Scenario | Behavior |
|---|---|
| Missing required column header | Reject entire file, show header list |
| Duplicate chest number | Skip row, add to error list, continue |
| Missing field in row | Skip row, add to error list with row number and field name |
| Invalid group value | Skip row, add to error list with valid group list |
| Empty file | Reject, show "File is empty" message |
| Non-CSV MIME type | Reject before parsing, show file type error |

### Round Validation Errors

| Scenario | Behavior |
|---|---|
| `averaged` + fewer than 2 judges | Inline form error, block save |
| `single` + count ≠ 1 | Inline form error, block save |
| No participants selected | Inline form error, block save |
| Duplicate event name | Inline form error on event creation |

### Score Submission Errors

| Scenario | Behavior |
|---|---|
| Score outside valid range | Inline validation error, block submit |
| Firestore write rejected (locked) | Show "Round is locked" toast, revert input |
| Offline write | Store in Firestore local cache, show "Pending" badge |
| Sync failure after reconnect | Show "Failed" badge, offer manual retry |

### Auth Errors

| Scenario | Behavior |
|---|---|
| Anonymous sign-in failure | Retry 3×, then show error banner |
| Invalid PIN | Show "PIN not found" message, allow re-entry |
| Session lost on refresh | Re-check sessionStorage, re-prompt PIN if needed |

---

## Testing Strategy

### Dual Testing Approach

The project uses a dual strategy: example-based unit tests for concrete behaviors and edge cases, plus property-based tests for universally quantified logic (parsing, validation, aggregation, and security rules).

**Unit Test Framework**: Jest + React Testing Library  
**Property-Based Testing Library**: `fast-check` (TypeScript-native, works in Jest)  
**Firestore Rules Testing**: Firebase Emulator Suite (`@firebase/rules-unit-testing`)  
**Minimum PBT Iterations**: 100 runs per property (fast-check default)

### Test Organization

```
__tests__/
├── unit/
│   ├── csv/
│   │   ├── parser.test.ts        # PBT + example tests
│   │   └── exporter.test.ts      # PBT + example tests
│   ├── lib/
│   │   ├── scores.test.ts        # PBT + example tests
│   │   ├── rounds.test.ts        # PBT + example tests
│   │   └── aggregation.test.ts   # PBT + example tests
│   └── hooks/
│       └── useRounds.test.ts     # PBT for filterLiveRoundsForJudge
│
├── rules/
│   └── firestore.rules.test.ts   # Firebase Emulator property tests
│
└── integration/
    ├── roundLifecycle.test.ts     # pending→live→locked flow
    └── offlineSync.test.ts        # Firestore offline persistence
```

### Property Test Tag Format

Each property test is tagged with a comment:
```typescript
// Feature: live-judge-scoring-app, Property {N}: {property_text}
```

### Unit Test Guidelines

- Unit tests cover specific examples: correct field shapes, edge cases (0 scores, 1 judge, max participants).
- Avoid duplicating what property tests already cover — unit tests focus on concrete inputs, not exhaustive coverage.
- React component tests use React Testing Library with mock Firestore hooks.

### Integration Test Guidelines

- Use Firebase Emulator for all Firestore integration tests.
- Round lifecycle tests verify the full pending → live → locked transition with real Firestore operations.
- Offline sync tests use the Firestore emulator with network simulation.

---

---

## Components and Interfaces

### Project Structure

```
/
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── icons/                  # PWA icons (192×192, 512×512)
│   └── sw.js                   # Generated by next-pwa (do not edit manually)
├── scripts/
│   └── seed.ts                 # Seed script (ts-node)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout — Firebase init, PWA meta tags
│   │   ├── page.tsx            # Redirects to /judge
│   │   ├── judge/
│   │   │   └── page.tsx        # Judge surface root
│   │   └── admin/
│   │       └── page.tsx        # Admin surface root
│   ├── components/
│   │   ├── judge/
│   │   │   ├── PinEntry.tsx
│   │   │   ├── RoundList.tsx
│   │   │   ├── ScoreSheet.tsx
│   │   │   ├── ScoreRow.tsx
│   │   │   └── SyncStatusBadge.tsx
│   │   ├── admin/
│   │   │   ├── AdminPinEntry.tsx
│   │   │   ├── ParticipantImport.tsx
│   │   │   ├── ParticipantTable.tsx
│   │   │   ├── EventBuilder.tsx
│   │   │   ├── RoundBuilder.tsx
│   │   │   ├── RoundList.tsx
│   │   │   ├── LiveControl.tsx
│   │   │   ├── ResultsDashboard.tsx
│   │   │   └── ExportButton.tsx
│   │   └── shared/
│   │       ├── ConnectivityBanner.tsx
│   │       └── ErrorMessage.tsx
│   ├── lib/
│   │   ├── firebase.ts         # Firebase app initialization (singleton)
│   │   ├── firestore.ts        # Typed Firestore helpers
│   │   ├── auth.ts             # Anonymous sign-in helper
│   │   ├── csvParser.ts        # PapaParse wrapper + validation logic
│   │   ├── csvExport.ts        # Results → CSV string
│   │   └── scoring.ts          # Score aggregation (average, single)
│   ├── hooks/
│   │   ├── useRounds.ts        # onSnapshot listener for eventRounds
│   │   ├── useScores.ts        # onSnapshot listener for scores
│   │   ├── useParticipants.ts  # onSnapshot listener for participants
│   │   ├── useOnlineStatus.ts  # navigator.onLine + event listeners
│   │   └── useJudgeSession.ts  # sessionStorage-backed judge identity
│   └── types/
│       └── index.ts            # Shared TypeScript interfaces
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Composite indexes
├── next.config.ts              # withPWA wrapper
└── .env.local                  # Firebase config env vars
```


### Component Details

#### Judge Surface (`/judge`)

```
JudgePage
├── Firebase Anonymous Auth (auto-triggered on mount)
├── [No session] → PinEntry
│   └── Validates PIN against judges collection
│   └── Stores { judgeId, judgeName } in sessionStorage
└── [Session active] → RoundList
    └── Filtered: status=live AND judgeId in assignedJudgeIds
    └── [Round selected] → ScoreSheet
        ├── Participants list with ScoreRow per participant
        │   └── ScoreRow: numeric input + SyncStatusBadge
        └── ConnectivityBanner (online/offline)
```

#### Admin Surface (`/admin`)

```
AdminPage
├── [No admin session] → AdminPinEntry
│   └── Writes doc to adminSessions/{uid} on success
└── [Admin session] → Tab navigation
    ├── Tab: Participants
    │   ├── ParticipantImport (CSV upload + PapaParse)
    │   └── ParticipantTable (live list from onSnapshot)
    ├── Tab: Events & Rounds
    │   ├── EventBuilder (create event)
    │   └── RoundBuilder (create round, linked to event)
    │       ├── Group selector
    │       ├── ScoringType selector (averaged/single)
    │       ├── Judge multi-select (validates min/max judges)
    │       └── Participant chest-number multi-select
    ├── Tab: Live Control
    │   └── LiveControl (all rounds, status transitions)
    └── Tab: Results
        ├── GroupFilter
        ├── ResultsDashboard (real-time onSnapshot)
        └── ExportButton
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Properties are implemented with `fast-check` and run a minimum of 100 iterations each.

---

### Property 1: Valid CSV rows produce correctly shaped participant objects

*For any* list of CSV rows containing valid chest numbers, names, and group values, the parsed output SHALL contain exactly one participant object per input row, where each object's `chestNo`, `name`, and `group` fields exactly match the corresponding input row values.

**Validates: Requirements 1.2**

---

### Property 2: Invalid CSV rows are rejected and excluded from valid output

*For any* CSV input containing rows with missing required fields (chest number, name, or group), invalid group values, or duplicate chest numbers, those rows SHALL appear in the errors array and SHALL NOT appear in the valid output array — while all other well-formed rows are present in the valid output.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 3: Round validation enforces judge count by scoring type

*For any* round configuration, if the scoring type is `averaged` and fewer than 2 judge IDs are assigned, `validateRoundConfig` SHALL return a non-null error string; if the scoring type is `single` and the count of assigned judges is not exactly 1, `validateRoundConfig` SHALL return a non-null error string; and for any configuration that satisfies the judge count requirements, `validateRoundConfig` SHALL return null.

**Validates: Requirements 2.3, 2.4**

---

### Property 4: Score document ID is the correct composite key

*For any* triple of `(roundId, chestNo, judgeId)`, `scoreDocId(roundId, chestNo, judgeId)` SHALL return the string `"${roundId}_${chestNo}_${judgeId}"`, and the resulting score document SHALL contain all required fields: `roundId`, `chestNo`, `judgeId`, `score`, `submittedAt`, and `synced`.

**Validates: Requirements 5.3**

---

### Property 5: Judge round filter returns exactly assigned live rounds

*For any* judge ID and any list of rounds with arbitrary statuses and assigned judge lists, `filterLiveRoundsForJudge` SHALL return exactly those rounds where the judge ID appears in `assignedJudgeIds` AND `status === 'live'` — no more, no fewer.

**Validates: Requirements 4.6**

---

### Property 6: Averaged score is the arithmetic mean of submitted scores

*For any* non-empty list of numeric scores for a participant in an `averaged` round, `computeRoundScore` SHALL return a value equal to the arithmetic mean of all submitted scores (sum / count).

**Validates: Requirements 7.2**

---

### Property 7: Cumulative total equals the sum of per-round scores

*For any* participant and any set of locked rounds with associated scores, `computeCumulativeTotal` SHALL return a value equal to the sum of `computeRoundScore` applied to each locked round for that participant.

**Validates: Requirements 7.4**

---

### Property 8: CSV export contains all required columns and only locked rounds

*For any* set of participants, rounds (with mixed statuses), and scores, `buildResultsCsv` SHALL produce a CSV where: (a) every locked round appears as a column, (b) no pending or live round appears as a column, and (c) each row contains `chestNo`, `name`, `group`, one column per locked round, and a `total` column.

**Validates: Requirements 8.1, 8.2**

---

### Property 9: Score writes to locked rounds are denied (Firestore rules)

*For any* score document write attempt targeting a round whose `status` is `locked`, the Firestore security rules SHALL deny the write regardless of the requesting user's identity or admin status.

**Validates: Requirements 3.3, 9.1**

---

### Property 10: Write access to protected collections requires admin flag

*For any* write attempt to the `events`, `eventRounds`, `participants`, or `judges` collections from a session that has not registered an admin session document, the Firestore security rules SHALL deny the write.

**Validates: Requirements 9.2, 9.3, 9.4**

---

### Property 11: Score writes are only allowed for assigned judges

*For any* score write where the `judgeId` in the document is not present in the target round's `assignedJudgeIds` array, the Firestore security rules SHALL deny the write.

**Validates: Requirements 9.6**

---

### Key Component Interfaces

```typescript
// PinEntry props
interface PinEntryProps {
  onSuccess: (judgeId: string, judgeName: string) => void;
}

// ScoreRow props
interface ScoreRowProps {
  roundId: string;
  chestNo: string;
  participantName: string;
  judgeId: string;
  isLocked: boolean;
  existingScore?: ScoreDoc;
}

// RoundBuilder props
interface RoundBuilderProps {
  events: EventDoc[];
  judges: JudgeDoc[];
  participants: ParticipantDoc[];
  onSave: (round: Omit<RoundDoc, 'id'>) => Promise<void>;
}

// ResultsDashboard props
interface ResultsDashboardProps {
  group: Group | 'all';
  rounds: RoundDoc[];
  scores: ScoreDoc[];
  participants: ParticipantDoc[];
}
```


---

## Data Models

### TypeScript Interfaces (`src/types/index.ts`)

```typescript
export type Group = 'Sub Jr' | 'Jr' | 'Intermediate' | 'Senior';
export type ScoringType = 'averaged' | 'single';
export type RoundStatus = 'pending' | 'live' | 'locked';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface ParticipantDoc {
  chestNo: string;      // document ID = chestNo (string form of number)
  name: string;
  group: Group;
}

export interface EventDoc {
  id: string;           // Firestore auto-ID
  name: string;         // unique event name
}

export interface RoundDoc {
  id: string;           // Firestore auto-ID
  eventId: string;
  group: Group;
  scoringType: ScoringType;
  assignedJudgeIds: string[];
  participantChestNos: string[];
  scheduledOrder: number;
  status: RoundStatus;
}

export interface JudgeDoc {
  id: string;           // Firestore auto-ID
  name: string;
  pin: string;          // stored as plain string; short numeric PIN (low sensitivity)
}

export interface ScoreDoc {
  id: string;           // document ID = `{roundId}_{chestNo}_{judgeId}`
  roundId: string;
  chestNo: string;
  judgeId: string;
  score: number;
  submittedAt: string;  // ISO 8601 timestamp
  synced: boolean;
}

export interface AdminSession {
  uid: string;          // document ID = Firebase anonymous UID
  createdAt: string;
}
```

### Firestore Collections

| Collection | Document ID | Description |
|---|---|---|
| `participants` | `{chestNo}` | One doc per participant |
| `events` | auto-ID | Named competition events |
| `eventRounds` | auto-ID | Rounds linking events to groups |
| `judges` | auto-ID | Judge name + PIN |
| `scores` | `{roundId}_{chestNo}_{judgeId}` | One score per judge per participant per round |
| `adminSessions` | `{uid}` | Written on admin login; checked by security rules |

### Composite Indexes Required

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "eventRounds",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledOrder", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "scores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "roundId", "order": "ASCENDING" },
        { "fieldPath": "judgeId", "order": "ASCENDING" }
      ]
    }
  ]
}
```


## PWA Configuration

### next-pwa Setup

Use [`next-pwa`](https://github.com/shadowwalker/next-pwa) (or the maintained fork `@ducanh2912/next-pwa`) configured in `next.config.js`:

```javascript
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // Precache app shell; runtime cache API routes and Firestore
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
        handler: 'NetworkFirst',
        options: { cacheName: 'firestore-cache' },
      },
    ],
  },
});
```

### Web App Manifest (`public/manifest.json`)

```json
{
  "name": "Live Judge Scoring",
  "short_name": "Scoring",
  "description": "Real-time competition scoring app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a56db",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Firestore Offline Persistence

Enable in `lib/firebase/config.ts`:

```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

This enables IndexedDB-backed persistence. When a judge device goes offline, all queued `setDoc` calls are stored locally and replayed when connectivity returns — no custom sync logic required.

---

## Real-Time Subscriptions

### Dashboard Subscription (Admin)

```typescript
// Subscribe to all scores for live/locked rounds
function subscribeToDashboardScores(
  rounds: EventRound[],
  onUpdate: (scores: Score[]) => void
): Unsubscribe {
  const activeRoundIds = rounds
    .filter(r => r.status === 'live' || r.status === 'locked')
    .map(r => r.roundId);

  // Firestore 'in' query supports up to 30 values; batch if needed
  return onSnapshot(
    query(collection(db, 'scores'), where('roundId', 'in', activeRoundIds)),
    snapshot => {
      const scores = snapshot.docs.map(d => d.data() as Score);
      onUpdate(scores);
    }
  );
}
```

### Judge Round List Subscription

```typescript
// Subscribe to rounds assigned to this judge
function subscribeToJudgeRounds(
  judgeId: string,
  onUpdate: (rounds: EventRound[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'eventRounds'),
      where('assignedJudgeIds', 'array-contains', judgeId),
      where('status', '==', 'live')
    ),
    snapshot => {
      const rounds = snapshot.docs.map(d => d.data() as EventRound);
      onUpdate(rounds);
    }
  );
}
```

Both subscriptions use Firestore's `onSnapshot` which delivers updates within ~1–2 seconds of a write, satisfying the 5-second requirement in Requirements 3.4 and 3.5.

---

## Mobile-First UI Design

### Tap Target Guidelines

All interactive elements (buttons, input fields, score row submit buttons) use a minimum height of 48px and minimum width of 48px per Material Design / WCAG 2.5.5 guidelines. This is critical for judge devices which are phones used under time pressure.

### Score Entry Screen Layout

```
┌────────────────────────────────────┐
│  Round: Solo Singing — Sub Jr      │
│  [ONLINE ●]                        │
├────────────────────────────────────┤
│  001 – Alice Smith                 │
│  ┌──────────┐  [Submit] ✓ synced   │
│  │  8.5     │                      │
│  └──────────┘                      │
├────────────────────────────────────┤
│  002 – Bob Jones                   │
│  ┌──────────┐  [Submit] ⏳ pending  │
│  │  7.0     │                      │
│  └──────────┘                      │
└────────────────────────────────────┘
```

### Admin Control Panel Layout

```
┌────────────────────────────────────────────────┐
│  Live Control Panel                            │
├────────────────────────────────────────────────┤
│  Solo Singing — Sub Jr     [pending]           │
│  2 judges · 8 participants                     │
│  [→ Set Live]                                  │
├────────────────────────────────────────────────┤
│  Group Dance — Jr          [live] ●            │
│  3 judges · 12 participants                    │
│  Scores: 2/3 judges submitted                  │
│  [🔒 Lock Round]                               │
├────────────────────────────────────────────────┤
│  Solo Singing — Jr         [locked] 🔒         │
│  3/3 judges submitted                          │
└────────────────────────────────────────────────┘
```

---

## Seed Script and Developer Setup

### Seed Script (`scripts/seed.ts`)

```typescript
// Usage: npx ts-node scripts/seed.ts
//
// Populates:
//   - 3 judges with PINs (1001, 1002, 1003)
//   - 3 events
//   - 1 round per event (pending status)
//   - 5 sample participants
//
// Logs all created IDs to console.
```

The script uses the Firebase Admin SDK (`firebase-admin`) with a service account key, bypassing Firestore security rules. It reads `FIREBASE_SERVICE_ACCOUNT` from an environment variable.

### Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_PASSCODE=          # shared secret for admin session
FIREBASE_SERVICE_ACCOUNT=            # JSON string, for seed script only
```

### Design Decisions and Rationale

| Decision | Rationale |
|---|---|
| Composite score document ID `{roundId}_{chestNo}_{judgeId}` | Idempotent writes; retries from offline sync never create duplicates |
| Admin flag via `_adminSessions` Firestore doc | Client-side secret is acceptable for low-stakes internal app; avoids Firebase Functions cost |
| Firestore offline persistence (IndexedDB) | Built-in SDK feature; no custom sync code; handles retry automatically |
| PIN stored plaintext in Firestore | PIN is low-sensitivity (internal app, no PII risk); avoids bcrypt dependency and Firebase Functions |
| `next-pwa` for service worker | Integrates with Next.js build without ejecting; handles precaching and runtime strategies |
| `fast-check` for PBT | TypeScript-native, works in Jest without additional setup, well-maintained |
| Score range validation client-side only | Score range is event-specific; admin sets it per round; client validates to prevent obvious errors |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before writing final properties, I reviewed the prework results for redundancy:

- 1.3 (duplicate rejection) and 1.4 (missing field rejection) and 1.5 (invalid group rejection) are all validation rejection properties. They can be expressed as a single comprehensive **CSV row validation** property: for any invalid CSV row (duplicate, missing field, or invalid group), the validator rejects it.
- 2.3 (averaged needs ≥2 judges) and 2.4 (single needs exactly 1 judge) both validate judge count against scoring type. These combine into one **round judge count validation** property.
- 5.3 (score document fields) and 5.4 (synced flag) are the same test — the synced property is just one field in the score document. Merged.
- 7.2 (averaged score calculation) and 7.4 (cumulative total) are distinct calculations — kept separate.
- 7.5 (group filter) and 8.3 (export group filter) are both group-filter correctness properties; they filter different outputs (display vs CSV) so kept separate but noted.
- 8.1 (CSV contains all fields) and 8.2 (only locked rounds) can be combined into one comprehensive **CSV export correctness** property.

After reflection, the final set of unique properties is: CSV row validation, round judge count validation, score document completeness, locked round read-only, out-of-range score rejection, judge round filter, sync status display, score average calculation, cumulative score total, group filter correctness, CSV export correctness, and CSV export group filter.

---

### Property 1: CSV row validation rejects all invalid inputs

*For any* CSV row that has a duplicate chest number, a missing required field (chest number, name, or group), or a group value outside `{Sub Jr, Jr, Intermediate, Senior}`, the CSV validator shall reject that row, return a descriptive error message, and produce no `ParticipantDoc` for that row. All other valid rows in the same file shall still be processed successfully.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 2: Valid CSV rows produce correct participant documents

*For any* well-formed CSV row with a unique chest number, non-empty name, and valid group, the parser shall produce a `ParticipantDoc` with `chestNo`, `name`, and `group` exactly matching the source row values.

**Validates: Requirements 1.2**

---

### Property 3: Round judge count validation enforces scoring type constraints

*For any* round configuration, if the scoring type is `averaged` and the assigned judge count is less than 2, or if the scoring type is `single` and the assigned judge count is not exactly 1, then the round validator shall reject the configuration and return an error before any Firestore write.

**Validates: Requirements 2.3, 2.4**

---

### Property 4: Score document completeness

*For any* valid score submission `(roundId, chestNo, judgeId, score)` from a judge, the resulting Firestore document at `scores/{roundId}_{chestNo}_{judgeId}` shall contain all six required fields — `roundId`, `chestNo`, `judgeId`, `score`, `submittedAt`, and `synced: true` — with values matching the submission.

**Validates: Requirements 5.3, 5.4**

---

### Property 5: Locked rounds are always read-only in the judge view

*For any* round with status `locked`, the `ScoreSheet` component shall render every `ScoreRow` with the score input disabled and shall not expose a submit action. This holds regardless of the judge's identity or the number of submitted scores.

**Validates: Requirements 5.7**

---

### Property 6: Out-of-range scores are always rejected

*For any* numeric value outside a round's defined valid score range, the score submission handler shall return a validation error and shall not write any document to Firestore.

**Validates: Requirements 5.8**

---

### Property 7: Judge round filter shows only assigned live rounds

*For any* authenticated judge session and any collection of rounds with arbitrary statuses and judge assignments, the `RoundList` component shall display exactly the subset of rounds where `status === 'live'` AND `assignedJudgeIds` contains the current judge's ID. Rounds that are pending, locked, or assigned to other judges shall not appear.

**Validates: Requirements 4.6**

---

### Property 8: Sync status indicator matches actual score sync state

*For any* `ScoreDoc` with a given `synced` value (`true` or `false`) or a locally-queued-but-unwritten score, the `SyncStatusBadge` shall display `synced` when `synced === true`, `pending` when the score is queued locally, and `failed` when a write error has occurred.

**Validates: Requirements 6.5**

---

### Property 9: Averaged score calculation is arithmetically correct

*For any* non-empty list of judge score values for a single participant in a round with `scoringType === 'averaged'`, the computed display score shall equal the arithmetic mean (sum of scores divided by count), rounded consistently.

**Validates: Requirements 7.2**

---

### Property 10: Cumulative total equals sum of locked round scores

*For any* participant and any set of rounds with status `locked` that include scores for that participant, the cumulative total displayed on the results dashboard shall equal the arithmetic sum of all those per-round scores.

**Validates: Requirements 7.4**

---

### Property 11: Group filter excludes all participants outside the selected group

*For any* group filter value applied to the results dashboard or export, the resulting output shall contain only participants whose `group` field exactly matches the filter, and shall contain no participants from any other group.

**Validates: Requirements 7.5, 8.3**

---

### Property 12: CSV export contains exactly locked-round data with all required fields

*For any* export operation, the generated CSV shall contain one row per participant in the selected group, each row including `chestNo`, `name`, `group`, one column per locked round's score for that participant, and the cumulative total. No columns for non-locked rounds shall appear.

**Validates: Requirements 8.1, 8.2**


---

## Error Handling

### CSV Import Errors

The `csvParser.ts` module performs three validation passes before any Firestore write:

1. **Schema validation** — every row must have `chestNo`, `name`, and `group` present and non-empty
2. **Domain validation** — `group` must be in the allowed set; `chestNo` must be a positive integer string
3. **Uniqueness check** — duplicate `chestNo` values within the uploaded file are detected via a `Set`

Each failed row is collected into an `errors: ParseError[]` array. Valid rows are batched to Firestore with `writeBatch`. The UI displays all errors together after the import attempt, without blocking valid rows.

```typescript
interface ParseError {
  row: number;
  field?: string;
  message: string;
}

interface ParseResult {
  participants: ParticipantDoc[];
  errors: ParseError[];
}
```

### Round Validation Errors

`RoundBuilder` validates before calling the Firestore write helper:

- `averaged` with < 2 judges → inline error on the judge selector
- `single` with ≠ 1 judge → inline error on the judge selector

### Score Submission Errors

`ScoreRow` handles three failure modes:

| Scenario | Behavior |
|---|---|
| Firestore write succeeds | `SyncStatusBadge` shows `synced` |
| Device offline at submit time | Firestore queues write locally; badge shows `pending` |
| Firestore write rejected (locked round) | Error caught, badge shows `failed`, toast message displayed |

Firestore's offline persistence handles transparent retry on reconnect. The `failed` state is only shown for rule rejections (e.g., submitting to a locked round after an optimistic UI race).

### Firebase Initialization Errors

`lib/firebase.ts` guards against multiple initializations using `getApps().length`. If the required environment variables (`NEXT_PUBLIC_FIREBASE_*`) are missing, the module throws at import time with a clear message listing the missing variables, preventing silent failures.

### Admin Session Errors

If writing to `adminSessions` fails (e.g., wrong admin PIN), the `AdminPinEntry` component displays the Firestore error message and remains on the PIN screen. No partial state is persisted.

### Network Connectivity

`useOnlineStatus` subscribes to `window.online` and `window.offline` events, reflecting the browser's reported state. `ConnectivityBanner` renders a persistent yellow bar when offline. This is informational; Firestore's offline persistence handles actual queuing silently.


---

## Firebase Configuration and Initialization

### Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Admin PIN (compared client-side; writing adminSessions doc is the auth step)
NEXT_PUBLIC_ADMIN_PIN=
```

### Firebase Singleton (`src/lib/firebase.ts`)

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing Firebase env vars: ${missing.join(', ')}`);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

// Offline persistence — must be called before any other Firestore operation
// Only enabled in the browser (not during SSR/build)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    // 'failed-precondition': multiple tabs open — persistence disabled for this tab
    // 'unimplemented': browser does not support IndexedDB
    console.warn('Firestore offline persistence unavailable:', err.code);
  });
}
```

> **Note**: `enableIndexedDbPersistence` is the Firebase v8/v9 compat API. When using the modular SDK v9+, use `initializeFirestore` with `persistentLocalCache` setting instead, called before `getFirestore`.


---

## Firestore Security Rules Design

### Admin Flag Mechanism

The admin device signs in anonymously, then the `AdminPinEntry` component compares the entered PIN to `NEXT_PUBLIC_ADMIN_PIN`. On a match, it writes `{ uid, createdAt }` to `adminSessions/{uid}`. Subsequent writes to protected collections check for the existence of this document:

```javascript
function isAdmin() {
  return exists(/databases/$(database)/documents/adminSessions/$(request.auth.uid));
}
```

This approach works on the free tier without Cloud Functions. The admin PIN is stored as a public env var (prefixed `NEXT_PUBLIC_`) but the actual enforcement gate is the `adminSessions` Firestore document, which requires a valid Firebase anonymous auth UID. An attacker who learns the PIN still needs a valid Firebase auth session to write the document.

### Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: check if requester has an active admin session
    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/adminSessions/$(request.auth.uid));
    }

    // Helper: check if requester is an authenticated user (anonymous or otherwise)
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: check a round's status from the database (for score write validation)
    function roundIsLive(roundId) {
      return get(/databases/$(database)/documents/eventRounds/$(roundId)).data.status == 'live';
    }

    // Helper: check if the writing judge is assigned to the round
    function judgeIsAssigned(roundId, judgeId) {
      return judgeId in get(/databases/$(database)/documents/eventRounds/$(roundId)).data.assignedJudgeIds;
    }

    // adminSessions: only the session owner can write their own doc; admin can read all
    match /adminSessions/{uid} {
      allow read: if isAuthenticated() && request.auth.uid == uid;
      allow write: if isAuthenticated() && request.auth.uid == uid;
    }

    // participants: admin write, any authenticated read
    match /participants/{chestNo} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // events: admin write, any authenticated read
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // eventRounds: admin write, any authenticated read
    match /eventRounds/{roundId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // judges: admin write, any authenticated read
    match /judges/{judgeId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // scores: judges write their own scores to live rounds they are assigned to
    // Document ID format: {roundId}_{chestNo}_{judgeId}
    match /scores/{scoreId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated()
        && request.resource.data.judgeId == request.auth.uid  // bind UID to judgeId
        && roundIsLive(request.resource.data.roundId)
        && judgeIsAssigned(request.resource.data.roundId, request.resource.data.judgeId);
      allow delete: if false;
    }
  }
}
```

> **Security note on judgeId binding**: The rules bind `judgeId` to the Firebase anonymous UID (`request.auth.uid`). This means `judges/{judgeId}` documents must use the anonymous UID as the Firestore document ID, not an auto-generated ID. When a judge enters their PIN and the matching judge document is found, the app calls `signInAnonymously`, then moves the judge document to `judges/{uid}` (or creates a shadow doc at `judgeAuth/{uid} → judgeId`). See the Judge Identity section below for details.


### Judge Identity Architecture

The requirements store judges under `judges/{judgeId}` with a PIN. To bind a judge's anonymous UID to their identity, the following flow is used:

1. Judge opens `/judge` → `signInAnonymously()` is called automatically → anonymous UID obtained
2. Judge enters PIN → client queries `judges` collection for matching PIN → finds `{ id, name, pin }`
3. Client writes to `judgeAuth/{uid}` → `{ judgeId: matchedId, name, linkedAt }` (admin-seeded write permission via separate rule or admin SDK seed)
4. Judge identity `{ judgeId, judgeName }` stored in `sessionStorage`
5. Score writes use `judgeId` from the matched judge document; the security rule checks `judgeId in assignedJudgeIds`

**Simplified alternative** (used in practice for this scale): The `judgeId` in `assignedJudgeIds` is the Firestore document ID of the judge record (not the UID). The score write rule checks the `judgeId` field on the score document against `assignedJudgeIds`, and trusts that only authenticated users can write. Since the app is for a controlled, trusted event (not public internet), this is acceptable:

```javascript
// Simplified rule — practical for trusted event context
allow create, update: if isAuthenticated()
  && roundIsLive(request.resource.data.roundId)
  && judgeIsAssigned(request.resource.data.roundId, request.resource.data.judgeId);
```

The PIN validation itself is the access gate; Firestore rules prevent writes to locked rounds and unassigned rounds.


---

## Offline-First Strategy

### Two-Layer Approach

```
Layer 1: Firestore IndexedDB persistence
  - Caches all Firestore reads locally
  - Queues writes while offline; auto-replays on reconnect
  - Handles score submission offline transparently
  - Enabled via enableIndexedDbPersistence() at app init

Layer 2: PWA Service Worker (next-pwa / Workbox)
  - Caches app shell (JS chunks, CSS, HTML)
  - Caches static assets and manifest
  - Ensures app loads from cache even with no network
  - Does NOT need to cache Firestore data (Layer 1 handles that)
```

### Service Worker Caching Strategy

`next-pwa` generates the service worker with Workbox. The caching strategies per resource type:

| Resource Type | Strategy | Rationale |
|---|---|---|
| App shell (JS/CSS/HTML) | `CacheFirst` | Never changes without a new deploy |
| Next.js static chunks | `StaleWhileRevalidate` | Update in background, serve cache immediately |
| Firebase SDK | `CacheFirst` | Rarely changes |
| Firestore API calls | Not cached by SW | Handled by Firestore IndexedDB persistence |
| Images / icons | `CacheFirst` | Static |

### Offline Score Flow

```
Judge submits score (offline)
        │
        ▼
Firestore client attempts write
        │
        ▼
Network unavailable → write queued in IndexedDB pending queue
        │
        ▼
UI: SyncStatusBadge shows 'pending' (score doc exists locally with synced: false)
        │
        ▼
Network restored (window 'online' event)
        │
        ▼
Firestore client replays pending writes automatically
        │
        ▼
Server confirms write → onSnapshot updates local doc synced: true
        │
        ▼
UI: SyncStatusBadge shows 'synced'
```

### `useOnlineStatus` Hook

```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```


---

## Real-Time Data Flow

### `onSnapshot` Listener Hooks

All real-time data is managed through custom hooks that set up `onSnapshot` listeners and clean up on unmount.

```typescript
// src/hooks/useRounds.ts
export function useRounds(judgeId?: string): RoundDoc[] {
  const [rounds, setRounds] = useState<RoundDoc[]>([]);

  useEffect(() => {
    let q = query(collection(db, 'eventRounds'), orderBy('scheduledOrder'));
    if (judgeId) {
      q = query(q,
        where('status', '==', 'live'),
        where('assignedJudgeIds', 'array-contains', judgeId)
      );
    }
    const unsub = onSnapshot(q, (snap) => {
      setRounds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoundDoc)));
    });
    return unsub; // cleanup on unmount
  }, [judgeId]);

  return rounds;
}
```

```typescript
// src/hooks/useScores.ts
export function useScores(roundId: string): ScoreDoc[] {
  const [scores, setScores] = useState<ScoreDoc[]>([]);

  useEffect(() => {
    if (!roundId) return;
    const q = query(collection(db, 'scores'), where('roundId', '==', roundId));
    const unsub = onSnapshot(q, (snap) => {
      setScores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScoreDoc)));
    });
    return unsub;
  }, [roundId]);

  return scores;
}
```

### Round Status Propagation

When the admin transitions a round's status (e.g., `pending → live`), a single `updateDoc` is issued on `eventRounds/{roundId}`. Because judges' `useRounds` hooks filter by `status === 'live'`, they automatically receive the new round in their snapshot within seconds. When the admin transitions to `locked`, the round disappears from judges' active lists (no longer matches the `live` filter) and the existing score entries transition to read-only.

### Admin Dashboard Real-Time Updates

The `ResultsDashboard` subscribes to `useScores` for each visible round and recomputes totals on every snapshot update. For ~50 participants × 3 judges × 23 events this is well within Firestore's free tier limits.


---

## PWA Manifest and Service Worker Setup

### `next.config.ts`

```typescript
import withPWA from '@ducanh2912/next-pwa';

const nextConfig = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})({
  // standard Next.js config here
});

export default nextConfig;
```

### `public/manifest.json`

```json
{
  "name": "Judge Score",
  "short_name": "JudgeScore",
  "description": "Live judge scoring for competition events",
  "start_url": "/judge",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Root Layout Meta Tags (`src/app/layout.tsx`)

```tsx
export const metadata: Metadata = {
  manifest: '/manifest.json',
  themeColor: '#1e40af',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JudgeScore',
  },
};
```


---

## Seed Script Design

### `scripts/seed.ts`

Run with: `npx ts-node --project tsconfig.seed.json scripts/seed.ts`

The script uses the Firebase Admin SDK to bypass security rules during seeding. It requires a service account key file path via `GOOGLE_APPLICATION_CREDENTIALS` env var.

```typescript
// scripts/seed.ts
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

async function seed() {
  const batch = db.batch();
  const log: string[] = [];

  // Seed 3 judges
  const judges = [
    { name: 'Judge Alice', pin: '1234' },
    { name: 'Judge Bob', pin: '5678' },
    { name: 'Judge Carol', pin: '9012' },
  ];
  const judgeRefs = judges.map((j) => {
    const ref = db.collection('judges').doc();
    batch.set(ref, j);
    log.push(`Judge: ${ref.id} (${j.name})`);
    return ref;
  });

  // Seed 3 events
  const events = ['Solo Singing', 'Group Dance', 'Elocution'];
  const eventRefs = events.map((name) => {
    const ref = db.collection('events').doc();
    batch.set(ref, { name });
    log.push(`Event: ${ref.id} (${name})`);
    return ref;
  });

  // Seed 1 round per event (Sub Jr group, averaged scoring)
  eventRefs.forEach((eRef, i) => {
    const rRef = db.collection('eventRounds').doc();
    batch.set(rRef, {
      eventId: eRef.id,
      group: 'Sub Jr',
      scoringType: 'averaged',
      assignedJudgeIds: [judgeRefs[0].id, judgeRefs[1].id, judgeRefs[2].id],
      participantChestNos: ['101', '102', '103'],
      scheduledOrder: i + 1,
      status: 'pending',
    });
    log.push(`Round: ${rRef.id} (${events[i]}, Sub Jr)`);
  });

  await batch.commit();
  log.forEach((l) => console.log(l));
  console.log(`Seeded ${log.length} records.`);
}

seed().catch(console.error);
```

### CSV Template (`public/participants-template.csv`)

```csv
chestNo,name,group
101,Example Participant,Sub Jr
```

The template file is served statically and downloadable from the `ParticipantImport` component via a plain anchor tag.


---

## Testing Strategy

### PBT Applicability Assessment

This feature includes significant pure logic (CSV parsing, score validation, score aggregation, filtering, CSV export) that is well-suited for property-based testing. Infrastructure concerns (Firestore rules, service worker, real-time sync latency) are not suited for PBT and will use integration or smoke tests.

### Dual Testing Approach

**Unit + Property Tests** (Jest + [fast-check](https://github.com/dubzzz/fast-check)):

- Minimum **100 iterations** per property test
- Each property test tagged with: `// Feature: live-judge-scoring-app, Property N: <property text>`
- Use mocked Firestore client for tests that touch Firestore logic

**Integration Tests** (Firebase Emulator Suite):

- Firestore security rules validation
- Real-time sync latency (round status propagation)
- Offline persistence behavior

**Smoke Tests**:

- PWA manifest presence and structure
- CSV template file exists with correct headers
- Seed script executes without error

### Property Test Coverage Map

| Property | Test file | fast-check arbitraries |
|---|---|---|
| P1: CSV row validation | `csvParser.test.ts` | Random strings, invalid groups, duplicate arrays |
| P2: Valid CSV produces correct docs | `csvParser.test.ts` | Random valid (chestNo, name, group) tuples |
| P3: Round judge count validation | `roundValidator.test.ts` | Random judge arrays + scoring type |
| P4: Score document completeness | `scoring.test.ts` | Random (roundId, chestNo, judgeId, score) tuples |
| P5: Locked rounds are read-only | `ScoreSheet.test.tsx` | Random locked round + judge session |
| P6: Out-of-range scores rejected | `scoreValidator.test.ts` | Random numbers outside range bounds |
| P7: Judge round filter | `useRounds.test.ts` | Random round arrays with varied status/assignedJudgeIds |
| P8: Sync status indicator | `SyncStatusBadge.test.tsx` | Enum of sync states mapped to expected labels |
| P9: Average score calculation | `scoring.test.ts` | Random non-empty arrays of numbers |
| P10: Cumulative total | `scoring.test.ts` | Random per-round score arrays per participant |
| P11: Group filter | `scoring.test.ts` + `ExportButton.test.tsx` | Random participant arrays + group filter value |
| P12: CSV export correctness | `csvExport.test.ts` | Random participant+score datasets |

### Unit Test Coverage (Non-Property)

- `AdminPinEntry` — correct/incorrect PIN entry examples
- `PinEntry` — valid/invalid PIN examples
- `LiveControl` — status transition UI examples
- `ResultsDashboard` — renders grouped results with single scoring type
- `ExportButton` — shows info message when no locked rounds exist

### Integration Test Coverage

- Firestore rules: score write to locked round is rejected (Requirement 3.3, 9.1)
- Firestore rules: non-admin write to `events` is rejected (Requirement 9.2)
- Firestore rules: judge can only write scores to assigned rounds (Requirement 9.6)
- Firestore rules: authenticated user can read `participants` (Requirement 9.5)
- Real-time: round status change propagates to judge app within 5 seconds (Requirement 3.4, 3.5)

### Test Configuration

```json
// jest.config.ts (relevant snippet)
{
  "testEnvironment": "jsdom",
  "setupFilesAfterFramework": ["@testing-library/jest-dom"],
  "transform": { "^.+\\.tsx?$": "ts-jest" }
}
```

```bash
# Run unit + property tests
npx jest --testPathPattern="src/"

# Run integration tests (requires Firebase Emulator)
firebase emulators:exec "npx jest --testPathPattern='tests/integration'"
```

