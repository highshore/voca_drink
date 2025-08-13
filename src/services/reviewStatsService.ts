import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
// (no-op) keep imports minimal; legacy alias removed to avoid unused warnings

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export type RatingDistribution = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

export async function getTodayRatingDistribution(
  uid: string,
  deck: string
): Promise<RatingDistribution> {
  const start = startOfDay(new Date());
  const qref = query(
    collection(db, "users", uid, "reviews"),
    where("deck", "==", deck),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(qref);
  const dist: RatingDistribution = { again: 0, hard: 0, good: 0, easy: 0 };
  // Also include latest FSRS review-only buckets if you choose to add a separate analytics path in future
  snap.forEach((d) => {
    const r = (d.data() as any).rating as string;
    if (r === "again") dist.again += 1;
    else if (r === "hard") dist.hard += 1;
    else if (r === "good") dist.good += 1;
    else if (r === "easy") dist.easy += 1;
  });
  return dist;
}

export async function get7DayRetention(
  uid: string,
  deck: string
): Promise<number> {
  const start = startOfDay(daysAgo(6)); // include today (7 days window)
  const qref = query(
    collection(db, "users", uid, "reviews"),
    where("deck", "==", deck),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(qref);
  let total = 0;
  let recalled = 0;
  snap.forEach((d) => {
    total += 1;
    const r = (d.data() as any).rating as string;
    if (r !== "again") recalled += 1;
  });
  if (total === 0) return 0;
  return recalled / total;
}
