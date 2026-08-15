// Union types
export type Group = 'Sub Jr' | 'Jr' | 'Intermediate' | 'Senior';
export type ScoringType = 'averaged' | 'single';
export type RoundStatus = 'pending' | 'live' | 'locked';
export type SyncStatus = 'synced' | 'pending' | 'failed';

// Core data interfaces
export interface ParticipantDoc {
  chestNo: string; // document ID = chestNo (string form of number)
  name: string;
  group: Group;
}

export interface EventDoc {
  id: string;
  name: string;
  location: 'onstage' | 'offstage';
  scoringMode: 'averaged' | 'singleByGroup';
}

export interface RoundDoc {
  id: string; // Firestore auto-ID
  eventId: string;
  group: Group;
  scoringType: ScoringType;
  assignedJudgeIds: string[];
  participantChestNos: string[];
  scheduledOrder: number;
  status: RoundStatus;
  scoreMin?: number;
  scoreMax?: number;
  batchMode: boolean; // true = offstage-style (score whenever), false = onstage-style (live sequential)
}

export interface JudgeDoc {
  id: string; // Firestore auto-ID
  name: string;
  pin: string; // stored as plain string; short numeric PIN (low sensitivity)
  deviceLinkToken: string;
}

export interface ScoreDoc {
  id: string; // document ID = `{roundId}_{chestNo}_{judgeId}`
  roundId: string;
  chestNo: string;
  judgeId: string;
  score: number;
  submittedAt: string; // ISO 8601 timestamp
  synced: boolean;
}

export interface AdminSession {
  uid: string; // document ID = Firebase anonymous UID
  createdAt: string;
}

// CSV interfaces
export interface ParseError {
  row: number;
  field: string;
  message: string;
}

export interface ParseResult {
  participants: ParticipantDoc[];
  errors: ParseError[];
}

export interface OffStageJudgeAssignmentDoc {
  group: Group; // document ID
  judgeId: string;
}

export interface PointsConfigDoc {
  eventId: string; // document ID
  first: number;
  second: number;
  third: number;
}

export interface PodiumRanking {
  chestNo: string;
  finalScore: number;
  rank: 1 | 2 | 3;
  pointsAwarded: number;
}

export interface PodiumDoc {
  id: string; // document ID = roundId
  eventId: string;
  group: Group;
  rankings: PodiumRanking[];
  computedAt: string;
  hasTie: boolean; // flag for admin review, don't auto-resolve silently
}

export interface ChestNoPointsTotalsDoc {
  chestNo: string; // document ID
  perGroupPoints: Partial<Record<Group, number>>;
  overallPoints: number;
}