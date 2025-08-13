import type {
  FsrsParameters,
  FsrsRating,
  FsrsMemoryState,
  ScheduleResult,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(fromIso: string | null, to: Date): number {
  if (!fromIso) return 0;
  const from = new Date(fromIso);
  const ms = to.getTime() - from.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

// FSRS-4.5 forgetting curve R(t,S) = (1 + (19/81) * (t / S))^(-0.5)
export function retrievability(tDays: number, stability: number): number {
  if (stability <= 0) return 0;
  const k = 19 / 81;
  return Math.pow(1 + k * (tDays / stability), -0.5);
}

// Inverse to get interval for desired retention r in (0,1)
export function intervalForRetention(
  retention: number,
  stability: number
): number {
  const k = 19 / 81;
  const r = clamp(retention, 0.01, 0.99);
  return (stability / k) * (Math.pow(r, -2) - 1);
}

// Update difficulty according to FSRS heuristic
function updateDifficulty(D: number, G: FsrsRating, w: number[]): number {
  // D' = clamp(1, 10, D - w6 * (G - 3)) with blending towards baseline via w7
  // Using baseline D0(3) = 5 per FSRS docs as a common choice
  const baseline = 5;
  const updated = D - w[5] * (G - 3);
  const blended = w[6] * baseline + (1 - w[6]) * updated; // note: w7 in docs is index 7 -> zero-based 6
  return clamp(blended, 1, 10);
}

// Successful review stability update (ratings 2-4)
function nextStabilitySuccess(
  D: number,
  S: number,
  R: number,
  G: FsrsRating,
  w: number[]
): number {
  // Based on FSRS-4.5 form: S' = S * (1 + e^{w8} * (11-D) * S^{-w9} * (e^{w10*(1-R)} - 1) * mG)
  const w8 = w[7];
  const w9 = w[8];
  const w10 = w[9];
  const mHard = w[14]; // multiplier for hard (index per docs w15)
  const mEasy = w[15]; // multiplier for easy (index per docs w16)
  const multiplier = G === 2 ? mHard : G === 4 ? mEasy : 1.0;
  const term =
    Math.exp(w8) *
    (11 - D) *
    Math.pow(Math.max(S, 1e-6), -w9) *
    (Math.exp(w10 * (1 - R)) - 1);
  const Snext = S * (1 + term * multiplier);
  return Math.max(0.01, Snext);
}

// Forgotten review stability update (rating 1)
function nextStabilityFailure(
  D: number,
  S: number,
  R: number,
  w: number[]
): number {
  // S'f = w11 * D^{-w12} * ((S+1)^{w13} - 1) * e^{w14*(1-R)}
  const w11 = w[10];
  const w12 = w[11];
  const w13 = w[12];
  const w14 = w[13];
  const part =
    Math.pow(D, -w12) * (Math.pow(S + 1, w13) - 1) * Math.exp(w14 * (1 - R));
  const Snext = w11 * part;
  return Math.max(0.01, Snext);
}

export function schedule(
  state: FsrsMemoryState,
  rating: FsrsRating,
  desiredRetention: number,
  params: FsrsParameters
): ScheduleResult {
  const now = new Date();
  const t = daysBetween(state.lastReviewedAt, now);
  const R = retrievability(t, Math.max(0.01, state.stability || 0.01));

  // Update difficulty and stability
  const D1 = updateDifficulty(state.difficulty || 5, rating, params.w);
  const S0 = Math.max(0.01, state.stability || 0.01);
  const S1 =
    rating === 1
      ? nextStabilityFailure(D1, S0, R, params.w)
      : nextStabilitySuccess(D1, S0, R, rating, params.w);

  // Compute next interval and due
  const intervalDays = Math.max(
    1,
    Math.round(intervalForRetention(desiredRetention, S1))
  );
  const due = new Date(now.getTime());
  due.setDate(due.getDate() + intervalDays);

  const newState: FsrsMemoryState = {
    stability: S1,
    difficulty: D1,
    lastReviewedAt: now.toISOString(),
    state: rating === 1 ? "lapsed" : "review",
  };

  return {
    newState,
    nextIntervalDays: intervalDays,
    nextDueAt: due.toISOString(),
    retrievability: R,
  };
}
