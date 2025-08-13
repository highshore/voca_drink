export type FsrsRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export type FsrsCardState = "new" | "review" | "lapsed";

export type FsrsParameters = {
  w: number[]; // length 17 for FSRS-4.5
};

export type FsrsMemoryState = {
  stability: number; // S
  difficulty: number; // D in [1,10]
  lastReviewedAt: string | null; // ISO timestamp
  state: FsrsCardState;
};

export type ScheduleResult = {
  nextIntervalDays: number;
  nextDueAt: string; // ISO timestamp
  newState: FsrsMemoryState;
  retrievability: number; // R before update
};
