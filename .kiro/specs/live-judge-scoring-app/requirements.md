# Requirements Document

## Introduction

A real-time judge scoring and tally web application for a competition event. The app supports approximately 50 participants divided into four age groups, competing across 23 events with multiple rounds per group. Three judges each use their own phone to score participants, with all data syncing over the internet via Firebase. An admin device manages all rounds and views a live results dashboard. The app is built as a Next.js Progressive Web App (PWA) using Firebase (Firestore, Hosting, Anonymous Auth) entirely on the free tier.

## Glossary

- **Admin_App**: The admin-facing section of the application accessible at `/admin`, used to manage participants, events, rounds, and view results.
- **Judge_App**: The judge-facing section of the application accessible at `/judge`, used by judges to score participants.
- **Participant**: A competition entrant identified by a unique chest number, belonging to one of four groups.
- **Group**: One of four age categories — Sub Jr, Jr, Intermediate, or Senior.
- **Event**: A named competition activity (e.g., "Solo Singing"), one of 23 total events.
- **Round**: A specific instance of an Event run for a particular Group, with its own participant list, timing, scoring type, and status.
- **Chest_Number**: A unique numeric identifier assigned to each participant.
- **Judge**: One of three officials who score participants, each identified by name and a PIN.
- **PIN**: A short numeric code used by judges to identify themselves in the Judge_App.
- **Scoring_Type**: The method used to aggregate scores — either `averaged` (all judges score, result is the average) or `single` (one assigned judge scores).
- **Score**: A numeric value submitted by a judge for a specific participant in a specific round.
- **Assigned_Judge**: The judge(s) designated to score a particular round.
- **Round_Status**: The lifecycle state of a round — one of `pending`, `live`, or `locked`.
- **Firestore**: The Firebase cloud database used for real-time data sync.
- **Anonymous_Auth**: Firebase Anonymous Authentication used to establish a secure, anonymous session for each device.
- **Admin_Flag**: A Firestore-level marker that grants elevated write permissions to the admin device.
- **PWA**: Progressive Web App — a web app installable on mobile devices with offline capabilities.
- **CSV**: Comma-Separated Values file format used for importing participants and exporting results.

---

## Requirements

### Requirement 1: Participant Management

**User Story:** As an admin, I want to import and manage participants via CSV, so that I can quickly set up all ~50 participants with their chest numbers and group assignments.

#### Acceptance Criteria

1. THE Admin_App SHALL provide a CSV import interface that accepts files with columns for chest number, participant name, and group.
2. WHEN a valid CSV file is uploaded, THE Admin_App SHALL parse and store each participant as a record in Firestore under `participants/{chestNo}` with name and group fields.
3. WHEN a CSV file contains a duplicate chest number, THE Admin_App SHALL reject that row, display a descriptive error message identifying the duplicate chest number, and SHALL NOT store the rejected row in Firestore while continuing to store all other valid rows.
4. WHEN a CSV file contains a row with a missing chest number, name, or group, THE Admin_App SHALL reject that row, display an error message identifying the missing field and row number, and SHALL NOT store the rejected row in Firestore while continuing to store all other valid rows.
5. WHEN a CSV file contains a group value not in the set {Sub Jr, Jr, Intermediate, Senior}, THE Admin_App SHALL reject that row, display a descriptive error message, and SHALL NOT store the rejected row in Firestore while continuing to store all other valid rows.
6. THE Admin_App SHALL display the current list of imported participants with their chest numbers, names, and groups; WHEN no participants have been imported, THE Admin_App SHALL display an empty list with column headers visible.
7. THE Admin_App SHALL provide a CSV template file for download containing the required column headers.

---

### Requirement 2: Event and Round Management

**User Story:** As an admin, I want to create and configure events and rounds, so that I can define the full competition schedule with the correct judges, participants, and scoring rules for each round.

#### Acceptance Criteria

1. THE Admin_App SHALL allow creation of events with a unique name, storing each event in Firestore under `events/{eventId}`.
2. THE Admin_App SHALL allow creation of rounds linked to an event, specifying the group, scoring type, assigned judges, participant chest numbers, and scheduled order, storing each round in Firestore under `eventRounds/{roundId}`.
3. WHEN creating a round with scoring type `averaged`, THE Admin_App SHALL require at least two assigned judges to be selected before the round can be saved.
4. WHEN creating a round with scoring type `single`, THE Admin_App SHALL require exactly one assigned judge to be selected before the round can be saved.
5. THE Admin_App SHALL allow the admin to assign any subset of the three registered judges to a round.
6. THE Admin_App SHALL allow the admin to specify the list of participant chest numbers for each round.
7. THE Admin_App SHALL display all rounds grouped by event, showing each round's group, scoring type, assigned judges, participant count, and status.
8. THE Admin_App SHALL allow the admin to set a round's scheduled order relative to other rounds.

---

### Requirement 3: Live Round Control

**User Story:** As an admin, I want to mark rounds as live or locked, so that I can control which rounds judges can currently score and prevent modification of completed rounds.

#### Acceptance Criteria

1. THE Admin_App SHALL allow the admin to transition a round's status from `pending` to `live`.
2. THE Admin_App SHALL allow the admin to transition a round's status from `live` to `locked`.
3. WHEN a round's status is set to `locked`, THE Firestore_Rules SHALL reject any new score write attempts for that round from any device.
4. WHEN a round's status is set to `live`, THE Judge_App SHALL display that round to assigned judges within 5 seconds of the status change.
5. WHEN a round's status is set to `locked`, THE Judge_App SHALL switch the round view to read-only within 5 seconds of the status change.
6. THE Admin_App SHALL display the current status of every round on the live control panel.
7. WHILE a round status is `pending`, THE Admin_App SHALL allow edits to round configuration including judges, participants, and scoring type.

---

### Requirement 4: Judge Identity and Access

**User Story:** As a judge, I want to identify myself using a PIN so that I can access only the rounds assigned to me without needing a traditional login.

#### Acceptance Criteria

1. THE Judge_App SHALL prompt the judge to enter a PIN before granting access to any scoring interface.
2. WHEN a judge enters a valid PIN matching a record in Firestore under `judges/{judgeId}`, THE Judge_App SHALL establish the judge's identity for the session.
3. WHEN a judge enters an invalid PIN, THE Judge_App SHALL display a descriptive error message and allow re-entry.
4. THE Judge_App SHALL use Firebase Anonymous Auth to establish a secure anonymous session before PIN verification.
5. THE Judge_App SHALL retain the judge's identity across page refreshes within the same browser session.
6. WHEN a judge's session is active, THE Judge_App SHALL display only the rounds for which that judge is an assigned judge AND whose status is `live`.

---

### Requirement 5: Score Submission

**User Story:** As a judge, I want to enter and submit scores for each participant in my assigned live rounds, so that results can be tallied in real time.

#### Acceptance Criteria

1. WHEN a judge selects a live round, THE Judge_App SHALL display the list of participant chest numbers (and names) assigned to that round.
2. THE Judge_App SHALL provide a numeric input field for each participant to enter a score.
3. WHEN a judge submits a score for a participant, THE Judge_App SHALL write the score to Firestore under `scores/{roundId}_{chestNo}_{judgeId}` with fields: roundId, chestNo, judgeId, score, submittedAt, and synced.
4. WHEN a score is successfully written to Firestore, THE Judge_App SHALL mark the score entry as synced.
5. WHEN a judge submits a score and the device has no internet connection, THE Judge_App SHALL store the score locally and display a pending sync indicator for that entry.
6. WHEN the device regains internet connectivity, THE Judge_App SHALL automatically sync all locally stored pending scores to Firestore.
7. WHEN a round's status is `locked`, THE Judge_App SHALL display submitted scores in read-only mode and SHALL NOT allow new score submissions for that round.
8. WHEN a judge attempts to submit a score outside the valid numeric range for a round, THE Judge_App SHALL display a validation error and reject the submission.

---

### Requirement 6: Offline-First Operation for Judges

**User Story:** As a judge, I want the app to work even when my internet connection is intermittent, so that I can continue scoring without disruption during connectivity gaps.

#### Acceptance Criteria

1. THE Judge_App SHALL cache all required round data (round details, participant list) locally using the PWA service worker when the round is first loaded.
2. WHEN the judge device is offline, THE Judge_App SHALL allow score entry and local storage for all cached rounds.
3. THE Judge_App SHALL display a persistent connectivity status indicator showing whether the device is online or offline.
4. WHEN the judge device transitions from offline to online, THE Judge_App SHALL sync all pending scores to Firestore without requiring any manual action from the judge.
5. THE Judge_App SHALL display a sync status indicator for each score entry showing one of: synced, pending, or failed.

---

### Requirement 7: Live Results Dashboard

**User Story:** As an admin, I want to see a live results dashboard that tallies scores in real time, so that I can monitor the competition standings as scoring happens.

#### Acceptance Criteria

1. THE Admin_App SHALL display a live results dashboard that updates in real time as scores are submitted to Firestore.
2. WHEN a round has scoring type `averaged`, THE Admin_App SHALL compute and display each participant's score as the average of all submitted judge scores for that round.
3. WHEN a round has scoring type `single`, THE Admin_App SHALL display the single assigned judge's submitted score as the participant's score for that round.
4. THE Admin_App SHALL display cumulative total scores per participant across all locked rounds within their group.
5. THE Admin_App SHALL allow the admin to filter the results dashboard by group (Sub Jr, Jr, Intermediate, Senior).
6. THE Admin_App SHALL display the current submission count versus expected submission count per round (e.g., "2 of 3 judges submitted").
7. WHEN a round is `live` or `locked`, THE Admin_App SHALL display scores in real time as they are submitted without requiring a page refresh.

---

### Requirement 8: Results Export

**User Story:** As an admin, I want to export competition standings as a CSV file, so that I can share or archive the final results.

#### Acceptance Criteria

1. THE Admin_App SHALL provide a CSV export function that generates a file containing each participant's chest number, name, group, per-round scores, and cumulative total.
2. WHEN the export is triggered, THE Admin_App SHALL include data only from rounds with status `locked`, and SHALL generate a partial file when some rounds are not yet locked, containing only the available locked round data.
3. THE Admin_App SHALL allow the admin to filter the export by group before downloading.
4. WHEN no locked rounds exist for the selected group, THE Admin_App SHALL display an informational message and SHALL NOT generate an empty file.

---

### Requirement 9: Security and Access Control

**User Story:** As a system operator, I want Firestore security rules to enforce access controls, so that judges cannot tamper with locked rounds and only the admin can manage events and rounds.

#### Acceptance Criteria

1. THE Firestore_Rules SHALL deny score writes to any round whose status is `locked`.
2. THE Firestore_Rules SHALL deny writes to `events` and `eventRounds` collections from devices that do not have the Admin_Flag set.
3. THE Firestore_Rules SHALL deny writes to `participants` from devices that do not have the Admin_Flag set.
4. THE Firestore_Rules SHALL deny writes to `judges` from devices that do not have the Admin_Flag set.
5. THE Firestore_Rules SHALL allow any authenticated session, including Firebase Anonymous Auth sessions, to read `events`, `eventRounds`, `participants`, and `judges` collections.
6. THE Firestore_Rules SHALL allow a judge to write scores only for rounds in which that judge is listed as an assigned judge.
7. THE Firestore_Rules SHALL allow any authenticated session to write scores to rounds with status `live`.

---

### Requirement 10: Progressive Web App Installation

**User Story:** As a judge or admin, I want to install the app on my phone's home screen, so that it behaves like a native app with fast load times and offline support.

#### Acceptance Criteria

1. THE PWA SHALL include a web app manifest with name, icons, theme color, and `display: standalone` configuration.
2. THE PWA SHALL register a service worker that caches critical application assets on first load.
3. WHEN a user visits the app on a supported mobile browser, THE PWA SHALL display an install prompt.
4. WHEN the app is launched from the home screen on any connection type, THE PWA SHALL load within 3 seconds by serving the app shell from the service worker cache without requiring a full network round-trip.

---

### Requirement 11: Seed Data and Developer Setup

**User Story:** As a developer, I want a seed script and CSV template so that I can quickly set up the app for a new competition without manual data entry.

#### Acceptance Criteria

1. THE System SHALL provide a seed script that populates Firestore with sample judges (3 records with names and PINs), sample events (at least 3 records), and at least one sample round per event linked to that event.
2. THE System SHALL provide a CSV template file with column headers matching the participant import format.
3. WHEN the seed script is executed, THE System SHALL log the IDs of all created records to the console.
4. THE System SHALL include a README file with setup instructions, environment variable configuration, Firebase project setup steps, and deployment instructions for both Firebase Hosting and Vercel.
