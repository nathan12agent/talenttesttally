# Implementation Plan: Live Judge Scoring & Tally App

## Overview

Implement a real-time judge scoring PWA using Next.js 14 App Router, Firebase (Firestore + Anonymous Auth + Hosting), and Tailwind CSS. The build is split into the Judge surface (`/judge`) and Admin surface (`/admin`), with offline-first score submission, live Firestore sync, and a results dashboard with CSV export.

## Tasks

- [x] 1. Project scaffold and configuration
  - Initialise a Next.js 14 App Router project with TypeScript and Tailwind CSS
  - Install dependencies: `firebase`, `@ducanh2912/next-pwa`, `papaparse`, `fast-check`, `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `ts-jest`, `@firebase/rules-unit-testing`
  - Create `next.config.ts` with `withPWA` wrapper (disable in development, `dest: 'public'`)
  - Create `.env.local` with all required `NEXT_PUBLIC_FIREBASE_*` variables and `NEXT_PUBLIC_ADMIN_PIN`
  - Create `public/manifest.json` with name, short_name, icons, theme_color, and `display: standalone`
  - Place placeholder PWA icons at `public/icons/icon-192.png` and `public/icons/icon-512.png`
  - Create `firestore.indexes.json` with composite indexes for `eventRounds` (status + scheduledOrder) and `scores` (roundId + judgeId)
  - Configure `jest.config.ts` with `jsdom` test environment, `ts-jest` transformer, and `@testing-library/jest-dom` setup file
  - _Requirements: 10.1, 10.2, 11.4_

- [x] 2. TypeScript types and Firebase initialisation
  - [x] 2.1 Create `src/types/index.ts` with all shared interfaces and union types
    - Define `Group`, `ScoringType`, `RoundStatus`, `SyncStatus` union types
    - Define `ParticipantDoc`, `EventDoc`, `RoundDoc`, `JudgeDoc`, `ScoreDoc`, `AdminSession` interfaces
    - Define `ParseError` and `ParseResult` interfaces for CSV parsing
    - _Requirements: 5.3, 1.2, 2.2_

  - [x] 2.2 Create `src/lib/firebase.ts` Firebase singleton
    - Guard against multiple initialisations with `getApps().length`
    - Throw at import time listing missing env vars
    - Export `app`, `auth`, `db`
    - Enable Firestore IndexedDB persistence via `initializeFirestore` with `persistentLocalCache` (browser-only guard)
    - _Requirements: 6.1, 6.4_

  - [x] 2.3 Create `src/lib/auth.ts` anonymous sign-in helper
    - Export `signInAnonymously` wrapper with 3-retry logic
    - _Requirements: 4.4_

- [x] 3. Core library functions
  - [x] 3.1 Create `src/lib/csvParser.ts`
    - Implement `parseParticipantCsv(csvText: string): ParseResult` using PapaParse
    - Schema validation: require `chestNo`, `name`, `group` fields
    - Domain validation: `group` must be in `{Sub Jr, Jr, Intermediate, Senior}`; `chestNo` must be a positive integer string
    - Uniqueness check: detect duplicate `chestNo` values within the file using a `Set`
    - Collect all errors into `errors: ParseError[]`; return valid rows in `participants: ParticipantDoc[]`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property tests for `csvParser.ts`
    - **Property 1: CSV row validation rejects all invalid inputs**
    - **Validates: Requirements 1.3, 1.4, 1.5**
    - **Property 2: Valid CSV rows produce correct participant documents**
    - **Validates: Requirements 1.2**
    - Tag each test: `// Feature: live-judge-scoring-app, Property N: <property text>`

  - [x] 3.3 Create `src/lib/scoring.ts`
    - Implement `scoreDocId(roundId, chestNo, judgeId): string` returning `"${roundId}_${chestNo}_${judgeId}"`
    - Implement `computeRoundScore(scores: number[], scoringType: ScoringType): number` — returns arithmetic mean for `averaged`, passes through single value for `single`
    - Implement `computeCumulativeTotal(perRoundScores: number[]): number` — sum of all round scores
    - Implement `filterLiveRoundsForJudge(rounds: RoundDoc[], judgeId: string): RoundDoc[]` — returns rounds where `status === 'live'` AND `judgeId` is in `assignedJudgeIds`
    - _Requirements: 5.3, 7.2, 7.4, 4.6_

  - [ ]* 3.4 Write property tests for `scoring.ts`
    - **Property 4: Score document completeness** — `scoreDocId` produces correct composite key
    - **Validates: Requirements 5.3**
    - **Property 7: Judge round filter shows only assigned live rounds**
    - **Validates: Requirements 4.6**
    - **Property 9: Averaged score calculation is arithmetically correct**
    - **Validates: Requirements 7.2**
    - **Property 10: Cumulative total equals sum of locked round scores**
    - **Validates: Requirements 7.4**

  - [x] 3.5 Create `src/lib/roundValidator.ts`
    - Implement `validateRoundConfig(config: Pick<RoundDoc, 'scoringType' | 'assignedJudgeIds'>): string | null`
    - Return error string if `averaged` with < 2 judges, or `single` with count ≠ 1
    - Return `null` for valid configurations
    - _Requirements: 2.3, 2.4_

  - [ ]* 3.6 Write property tests for `roundValidator.ts`
    - **Property 3: Round judge count validation enforces scoring type constraints**
    - **Validates: Requirements 2.3, 2.4**

  - [x] 3.7 Create `src/lib/scoreValidator.ts`
    - Implement `validateScore(value: number, min: number, max: number): string | null`
    - Return error string for values outside `[min, max]`, `null` for valid values
    - _Requirements: 5.8_

  - [ ]* 3.8 Write property tests for `scoreValidator.ts`
    - **Property 6: Out-of-range scores are always rejected**
    - **Validates: Requirements 5.8**

  - [x] 3.9 Create `src/lib/csvExport.ts`
    - Implement `buildResultsCsv(participants, rounds, scores, groupFilter): string`
    - Include one row per participant in the selected group: `chestNo`, `name`, `group`, one column per locked round, `total`
    - Exclude non-locked rounds from columns
    - Return empty string (no file) when no locked rounds exist for the selected group
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 3.10 Write property tests for `csvExport.ts`
    - **Property 11: Group filter excludes all participants outside the selected group**
    - **Validates: Requirements 7.5, 8.3**
    - **Property 12: CSV export contains exactly locked-round data with all required fields**
    - **Validates: Requirements 8.1, 8.2**

- [x] 4. Firestore helpers and real-time hooks
  - [x] 4.1 Create `src/lib/firestore.ts` typed Firestore helpers
    - Write typed read/write helpers for all collections: `participants`, `events`, `eventRounds`, `judges`, `scores`, `adminSessions`
    - Include `setScore`, `upsertParticipant`, `createEvent`, `createRound`, `updateRoundStatus`, `setAdminSession`
    - _Requirements: 1.2, 2.1, 2.2, 3.1, 3.2, 5.3_

  - [x] 4.2 Create `src/hooks/useRounds.ts`
    - Export `useRounds(judgeId?: string): RoundDoc[]`
    - When `judgeId` is provided: filter by `status === 'live'` and `assignedJudgeIds array-contains judgeId`
    - When no `judgeId`: return all rounds ordered by `scheduledOrder`
    - Clean up `onSnapshot` subscription on unmount
    - _Requirements: 3.4, 3.5, 4.6_

  - [x] 4.3 Create `src/hooks/useScores.ts`
    - Export `useScores(roundId: string): ScoreDoc[]`
    - Subscribe via `onSnapshot` filtered by `roundId`
    - Clean up on unmount
    - _Requirements: 7.1, 7.7_

  - [x] 4.4 Create `src/hooks/useParticipants.ts`
    - Export `useParticipants(): ParticipantDoc[]`
    - Subscribe via `onSnapshot` on the `participants` collection
    - Clean up on unmount
    - _Requirements: 1.6_

  - [x] 4.5 Create `src/hooks/useOnlineStatus.ts`
    - Export `useOnlineStatus(): boolean`
    - Subscribe to `window.online` / `window.offline` events
    - Return `navigator.onLine` as initial state; guard for SSR
    - _Requirements: 6.3_

  - [x] 4.6 Create `src/hooks/useJudgeSession.ts`
    - Export `useJudgeSession(): { judgeId, judgeName, setSession, clearSession }`
    - Persist `{ judgeId, judgeName }` in `sessionStorage`
    - Rehydrate from `sessionStorage` on mount
    - _Requirements: 4.5_

- [x] 5. Checkpoint — Core library and hooks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Shared and Judge surface components
  - [x] 6.1 Create `src/components/shared/ConnectivityBanner.tsx`
    - Render a persistent yellow bar when `useOnlineStatus()` returns `false`
    - _Requirements: 6.3_

  - [x] 6.2 Create `src/components/shared/ErrorMessage.tsx`
    - Render an inline error message string as a styled paragraph
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 6.3 Create `src/components/judge/SyncStatusBadge.tsx`
    - Accept a `syncStatus: SyncStatus` prop and an optional `isLocal?: boolean` flag
    - Display "synced" (green check) when `synced === true`, "pending" (spinner) when locally queued, "failed" (red X) on write error
    - Minimum 48 × 48 px tap target
    - _Requirements: 6.5_

  - [ ]* 6.4 Write property tests for `SyncStatusBadge.tsx`
    - **Property 8: Sync status indicator matches actual score sync state**
    - **Validates: Requirements 6.5**

  - [x] 6.5 Create `src/components/judge/PinEntry.tsx`
    - Accept `onSuccess: (judgeId: string, judgeName: string) => void`
    - Query `judges` collection for matching PIN; display "PIN not found" on mismatch
    - On match, call `onSuccess`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.6 Create `src/components/judge/ScoreRow.tsx`
    - Accept `roundId`, `chestNo`, `participantName`, `judgeId`, `isLocked`, `existingScore?: ScoreDoc`
    - Render numeric input + Submit button (min 48 px height)
    - Validate score against round's min/max before write; show inline error on rejection
    - Write `ScoreDoc` to Firestore via `scoreDocId`; manage local sync status state
    - Render read-only when `isLocked` is true
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

  - [ ]* 6.7 Write property test for `ScoreRow.tsx` / `ScoreSheet.tsx` locked state
    - **Property 5: Locked rounds are always read-only in the judge view**
    - **Validates: Requirements 5.7**

  - [x] 6.8 Create `src/components/judge/ScoreSheet.tsx`
    - Accept a `RoundDoc` and judge session; render a `ScoreRow` per participant
    - Show `ConnectivityBanner` at the top
    - Pass `isLocked` derived from `round.status === 'locked'`
    - _Requirements: 5.1, 5.7, 6.1, 6.2_

  - [x] 6.9 Create `src/components/judge/RoundList.tsx` (judge variant)
    - Accept list of live rounds from `useRounds(judgeId)`
    - Render selectable round cards; on tap, show `ScoreSheet`
    - _Requirements: 4.6, 3.4_

- [x] 7. Admin surface components
  - [x] 7.1 Create `src/components/admin/AdminPinEntry.tsx`
    - Compare entered PIN to `NEXT_PUBLIC_ADMIN_PIN`
    - On match, call `signInAnonymously()` then write `{ uid, createdAt }` to `adminSessions/{uid}`
    - Display Firestore error on write failure; stay on PIN screen
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 7.2 Create `src/components/admin/ParticipantImport.tsx`
    - Render file input accepting CSV MIME type
    - On file select, read as text, call `parseParticipantCsv`, display all `ParseError` entries
    - Write valid participants to Firestore in a batch
    - Render download link to `/participants-template.csv`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 7.3 Create `src/components/admin/ParticipantTable.tsx`
    - Subscribe via `useParticipants()`; render table with chest number, name, group columns
    - Show header row with empty-list message when no participants imported
    - _Requirements: 1.6_

  - [x] 7.4 Create `src/components/admin/EventBuilder.tsx`
    - Form to create a new event with a unique name; write to `events/{eventId}`
    - Show inline error if event name already exists (query before write)
    - _Requirements: 2.1_

  - [x] 7.5 Create `src/components/admin/RoundBuilder.tsx`
    - Accept `events`, `judges`, `participants`, `onSave` props
    - Fields: event selector, group selector, scoring type, judge multi-select (show `validateRoundConfig` error inline), participant chest-number multi-select, scheduled order
    - Disable Save until `validateRoundConfig` returns `null`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [x] 7.6 Create `src/components/admin/RoundList.tsx` (admin variant)
    - Render all rounds grouped by event from `useRounds()`
    - Display group, scoring type, assigned judges, participant count, and status per round
    - _Requirements: 2.7_

  - [x] 7.7 Create `src/components/admin/LiveControl.tsx`
    - List all rounds with current status badges
    - "Set Live" button for `pending` rounds; "Lock Round" button for `live` rounds
    - Show submission count progress (e.g., "2 of 3 judges submitted") using `useScores`
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 7.8 Create `src/components/admin/ResultsDashboard.tsx`
    - Accept `group`, `rounds`, `scores`, `participants` props
    - Compute per-participant per-round scores using `computeRoundScore`
    - Compute cumulative totals using `computeCumulativeTotal`
    - Display submission count vs expected per round
    - Subscribe to score updates in real time (data passed from parent `onSnapshot` hooks)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

  - [x] 7.9 Create `src/components/admin/ExportButton.tsx`
    - Accept group filter and data props
    - Call `buildResultsCsv`; trigger browser download via `Blob` + anchor click
    - Show informational message and disable button when no locked rounds exist for selected group
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Page routes and root layout
  - [x] 8.1 Create `src/app/layout.tsx` root layout
    - Add PWA `<meta>` tags and `manifest` link via Next.js `Metadata` API
    - Initialise Firebase on mount (client component wrapper)
    - _Requirements: 10.1, 10.2_

  - [x] 8.2 Create `src/app/page.tsx` root redirect
    - Server component that redirects to `/judge`
    - _Requirements: (navigation)_

  - [x] 8.3 Create `src/app/judge/page.tsx` Judge surface root
    - Trigger `signInAnonymously` on mount
    - Show `PinEntry` when no judge session; show `RoundList` + `ScoreSheet` when session active
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 8.4 Create `src/app/admin/page.tsx` Admin surface root
    - Show `AdminPinEntry` when no admin session
    - When session active, render four tabs: Participants, Events & Rounds, Live Control, Results
    - Wire group filter state to `ResultsDashboard` and `ExportButton`
    - _Requirements: 7.5, 8.3_

- [x] 9. Firestore security rules
  - [x] 9.1 Write `firestore.rules`
    - Implement `isAdmin()` helper checking `adminSessions/{uid}`
    - Implement `isAuthenticated()` helper
    - Implement `roundIsLive(roundId)` and `judgeIsAssigned(roundId, judgeId)` helpers
    - `adminSessions`: owner read/write only
    - `participants`, `events`, `eventRounds`, `judges`: admin write; authenticated read
    - `scores`: authenticated read; create/update requires `roundIsLive` AND `judgeIsAssigned`; delete denied
    - _Requirements: 3.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 9.2 Write integration tests for Firestore security rules (Firebase Emulator)
    - **Property 9: Score writes to locked rounds are denied**
    - **Validates: Requirements 3.3, 9.1**
    - **Property 10: Write access to protected collections requires admin flag**
    - **Validates: Requirements 9.2, 9.3, 9.4**
    - **Property 11: Score writes are only allowed for assigned judges**
    - **Validates: Requirements 9.6**
    - Test authenticated read of `participants` is allowed (Requirement 9.5)

- [x] 10. Checkpoint — Rules and security tests complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Seed script, CSV template, and developer setup
  - [x] 11.1 Create `scripts/seed.ts`
    - Use Firebase Admin SDK; read credentials from `GOOGLE_APPLICATION_CREDENTIALS`
    - Seed 3 judges with PINs, 3 events, 1 round per event (pending, Sub Jr, averaged)
    - Seed 5 sample participants
    - Log all created record IDs to console
    - _Requirements: 11.1, 11.3_

  - [x] 11.2 Create `public/participants-template.csv`
    - Include header row: `chestNo,name,group` and one example data row
    - _Requirements: 1.7, 11.2_

  - [x] 11.3 Create `README.md` with setup instructions
    - Environment variable configuration, Firebase project setup, seeding, and deployment steps for Firebase Hosting and Vercel
    - _Requirements: 11.4_

- [ ] 12. Final checkpoint — End-to-end validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- All interactive elements must have a minimum 48 × 48 px tap target (WCAG 2.5.5)
- Firestore IndexedDB persistence handles offline score queuing automatically — no custom sync logic required
- The `scoreDocId` composite key pattern makes score writes idempotent (safe to retry offline)
- PIN is stored in plaintext in Firestore — acceptable for this low-sensitivity internal event app
- `judgeId` in score documents refers to the Firestore document ID of the matching judge record; the simplified Firestore rule (not UID-binding) is used as documented in the design
- Integration tests for Firestore rules require the Firebase Emulator Suite to be running

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["3.1", "3.3", "3.5", "3.7", "3.9", "4.1"] },
    { "id": 2, "tasks": ["3.2", "3.4", "3.6", "3.8", "3.10", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 3, "tasks": ["6.1", "6.2", "6.3", "6.5", "6.8", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "9.1"] },
    { "id": 4, "tasks": ["6.4", "6.6", "6.7", "6.9", "7.7", "7.8", "7.9", "9.2"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4", "11.1", "11.2", "11.3"] }
  ]
}
```
