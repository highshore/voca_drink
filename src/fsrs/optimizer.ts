import type { FsrsParameters, FsrsRating, FsrsMemoryState } from "./types";
import { retrievability, schedule } from "./scheduler";

export type ReviewLog = {
  cardId: string; // deck:vocabId or any unique id
  reviewTimestamp: string; // ISO timestamp
  userRating: FsrsRating; // 1..4
};

export type OptimizeResult = {
  parameters: FsrsParameters;
  loss: number;
};

// Binary cross-entropy between observed recall (again=0, else=1) and predicted R
function bceLoss(y: number, p: number): number {
  const eps = 1e-8;
  const pe = Math.min(1 - eps, Math.max(eps, p));
  return -(y * Math.log(pe) + (1 - y) * Math.log(1 - pe));
}

export function simulateLoss(
  logs: ReviewLog[],
  initial: FsrsParameters,
  initialDifficulty = 5,
  initialStability = 0.01
): number {
  // Group by card
  const byCard = new Map<string, ReviewLog[]>();
  for (const l of logs) {
    const arr = byCard.get(l.cardId) ?? [];
    arr.push(l);
    byCard.set(l.cardId, arr);
  }
  // Sort each by time asc
  for (const arr of byCard.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.reviewTimestamp).getTime() -
        new Date(b.reviewTimestamp).getTime()
    );
  }

  let totalLoss = 0;
  let count = 0;

  for (const [, arr] of byCard.entries()) {
    let state: FsrsMemoryState = {
      stability: initialStability,
      difficulty: initialDifficulty,
      lastReviewedAt: null,
      state: "new",
    };
    for (const l of arr) {
      const t = state.lastReviewedAt
        ? (new Date(l.reviewTimestamp).getTime() -
            new Date(state.lastReviewedAt).getTime()) /
          (1000 * 60 * 60 * 24)
        : 0;
      const R = retrievability(t, Math.max(0.01, state.stability));
      const y = l.userRating === 1 ? 0 : 1;
      totalLoss += bceLoss(y, R);
      count += 1;
      // Advance state using the historical rating at that time
      const next = schedule(state, l.userRating, 0.9, initial);
      // But keep the historical timestamp as lastReviewedAt for next iteration
      state = { ...next.newState, lastReviewedAt: l.reviewTimestamp };
    }
  }

  return count > 0 ? totalLoss / count : 0;
}

// Placeholder optimizer: returns input parameters and its loss.
// In production, call into a numerical optimizer (e.g., Python SciPy) to adjust 'w'.
export async function optimizeParameters(
  logs: ReviewLog[],
  start: FsrsParameters
): Promise<OptimizeResult> {
  const loss = simulateLoss(logs, start);
  return { parameters: start, loss };
}
