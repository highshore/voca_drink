import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "../firebase";
import { db } from "../firebase";

export function userDocRef(uid: string) {
  return doc(db, "users", uid);
}

export async function ensureUserDocument(user: User): Promise<void> {
  const ref = userDocRef(user.uid);
  const snap = await getDoc(ref);
  const base = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    dailyGoal: 20,
    reviewsToday: 0,
    reviewsTodayDate: null as string | null,
    streakDays: 0,
  };
  if (!snap.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  }
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function incrementReviewStats(uid: string): Promise<void> {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  const today = formatDateYMD(new Date());
  if (!snap.exists()) return;
  const data = snap.data() as any;
  const prevDate: string | null = data.reviewsTodayDate ?? null;
  const prevStreak: number = Number(data.streakDays ?? 0) || 0;
  let reviewsToday: number = Number(data.reviewsToday ?? 0) || 0;

  if (prevDate === today) {
    reviewsToday += 1;
    await updateDoc(ref, { reviewsToday, lastLoginAt: serverTimestamp() });
    return;
  }

  // If last activity was yesterday, increment streak, else reset
  const d = new Date();
  const yesterday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  const ymdYesterday = formatDateYMD(yesterday);
  const newStreak =
    prevDate === ymdYesterday ? prevStreak + 1 : Math.max(prevStreak, 1);
  await updateDoc(ref, {
    reviewsToday: 1,
    reviewsTodayDate: today,
    streakDays: newStreak,
    lastLoginAt: serverTimestamp(),
  });
}

// Memorized API
function memorizedColRef(uid: string) {
  return collection(db, "users", uid, "memorized");
}

export async function getMemorizedSetForDeck(
  uid: string,
  deck: string
): Promise<Set<string>> {
  const snap = await getDocs(memorizedColRef(uid));
  const ids = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.deck === deck && typeof data.vocabId === "string")
      ids.add(data.vocabId);
  });
  return ids;
}

export async function setMemorized(
  uid: string,
  deck: string,
  vocabId: string,
  kana?: string
): Promise<void> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "memorized", id);
  await setDoc(
    ref,
    {
      deck,
      vocabId,
      kana: kana ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function unsetMemorized(
  uid: string,
  deck: string,
  vocabId: string
): Promise<void> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "memorized", id);
  await deleteDoc(ref);
}

// Current deck preference
export async function getUserCurrentDeck(uid: string): Promise<string | null> {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return (data.currentDeck as string) ?? null;
}

export async function setUserCurrentDeck(
  uid: string,
  deck: string
): Promise<void> {
  const ref = userDocRef(uid);
  await setDoc(
    ref,
    { currentDeck: deck, lastLoginAt: serverTimestamp() },
    { merge: true }
  );
}

// --- SRS Scheduling (Anki-like) ---
export type SrsEntry = {
  deck: string;
  vocabId: string;
  easeFactor: number; // EF
  intervalDays: number; // current interval in days
  repetitions: number; // successful reviews in a row
  dueAt: string; // ISO date string
  lastReviewedAt?: string; // ISO date
  createdAt?: any;
  updatedAt?: any;
};

export async function getSrsMapForDeck(
  uid: string,
  deck: string
): Promise<Map<string, SrsEntry>> {
  const snap = await getDocs(collection(db, "users", uid, "srs"));
  const map = new Map<string, SrsEntry>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.deck === deck && typeof data.vocabId === "string") {
      map.set(data.vocabId, data as SrsEntry);
    }
  });
  return map;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function minutesFromNow(minutes: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export type Rating = "again" | "hard" | "good" | "easy";

export async function updateSrsOnAnswer(
  uid: string,
  deck: string,
  vocabId: string,
  rating: Rating
): Promise<SrsEntry> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "srs", id);
  const snap = await getDoc(ref);
  const now = new Date();
  let entry: SrsEntry;
  if (snap.exists()) {
    entry = snap.data() as SrsEntry;
  } else {
    entry = {
      deck,
      vocabId,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: now.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as unknown as SrsEntry;
  }

  // Simplified SM-2 update
  let { easeFactor: ef, intervalDays: ivl, repetitions: reps } = entry;

  const qualities: Record<Rating, number> = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = qualities[rating];

  if (rating === "again") {
    reps = 0;
    ivl = 0;
    // learning step: 10 minutes later
    entry.dueAt = minutesFromNow(10).toISOString();
  } else {
    // Adjust EF per SM-2 formula
    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (ef < 1.3) ef = 1.3;

    if (reps === 0) {
      // first success
      ivl = 1;
    } else if (reps === 1) {
      ivl = 6;
    } else {
      ivl = Math.round(ivl * ef);
    }
    reps += 1;
    entry.dueAt = addDays(now, ivl).toISOString();
  }

  entry.easeFactor = ef;
  entry.intervalDays = ivl;
  entry.repetitions = reps;
  entry.lastReviewedAt = now.toISOString();

  await setDoc(
    ref,
    {
      ...entry,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return entry;
}

export async function recordReviewEvent(
  uid: string,
  deck: string,
  vocabId: string,
  rating: Rating
): Promise<void> {
  const col = collection(db, "users", uid, "reviews");
  await addDoc(col, {
    deck,
    vocabId,
    rating,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserLastReview(
  uid: string,
  deck: string,
  vocabId: string,
  rating: Rating
): Promise<void> {
  const ref = userDocRef(uid);
  await setDoc(
    ref,
    {
      lastReviewed: {
        deck,
        vocabId,
        rating,
        at: serverTimestamp(),
      },
    },
    { merge: true }
  );
}
