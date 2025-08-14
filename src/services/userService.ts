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
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import type { User } from "../firebase";
import { db, storage } from "../firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import type { LanguageCode } from "../i18n/messages";

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
    language: (typeof navigator !== "undefined" &&
      (navigator.language?.startsWith("ko") ? "ko" : "en")) as LanguageCode,
  };
  if (!snap.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  }
}

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  photoPath?: string | null;
  dailyGoal: number;
  language?: LanguageCode;
};

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    uid: d.uid ?? uid,
    email: (d.email as string) ?? null,
    displayName: (d.displayName as string) ?? null,
    photoURL: (d.photoURL as string) ?? null,
    photoPath: (d.photoPath as string | null | undefined) ?? null,
    dailyGoal: Number(d.dailyGoal ?? 20),
    language: (d.language as LanguageCode | undefined) ?? undefined,
  };
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      "displayName" | "dailyGoal" | "language" | "photoURL" | "photoPath"
    >
  >
): Promise<void> {
  const ref = userDocRef(uid);
  await setDoc(
    ref,
    { ...updates, lastLoginAt: serverTimestamp() },
    { merge: true }
  );
}

export async function uploadAndSetUserAvatar(
  uid: string,
  file: File
): Promise<{ url: string; path: string }> {
  const path = `users/${uid}/avatar`;
  const storageRef = ref(storage, path);

  // One-time cleanup if legacy timestamped path exists
  try {
    const snap = await getDoc(userDocRef(uid));
    const oldPath = (snap.exists() ? (snap.data() as any)?.photoPath : null) as
      | string
      | null
      | undefined;
    if (oldPath && oldPath !== path) {
      try {
        await deleteObject(ref(storage, oldPath));
      } catch (_) {}
    }
  } catch (_) {}

  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined,
    cacheControl: "public, max-age=0, no-cache",
  });
  const baseUrl = await getDownloadURL(storageRef);
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
  await updateUserProfile(uid, { photoURL: url, photoPath: path });
  return { url, path };
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
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid,
        reviewsToday: 1,
        reviewsTodayDate: today,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }
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
export type SrsStage = "new" | "learning" | "review" | "relearning";
export type SrsEntry = {
  deck: string;
  vocabId: string;
  easeFactor: number; // EF, e.g., 2.5
  intervalDays: number; // interval in days for review cards
  repetitions: number; // successful reviews in a row
  dueAt: string; // ISO date string
  stage: SrsStage;
  stepIndex?: number; // for learning/relearning
  prevIntervalDays?: number; // for lapses
  lastReviewedAt?: string; // ISO date
  createdAt?: any;
  updatedAt?: any;
};

const DEFAULT_DECK_OPTS = {
  learningStepsMinutes: [1, 10],
  relearnStepsMinutes: [10],
  graduatingIntervalDays: 1,
  easyInitialIntervalDays: 4,
  hardIntervalFactor: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  minEaseFactor: 1.3,
  lapseNewIntervalFactor: 0.0, // on lapse, when graduating from relearn, multiply previous interval
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
      stage: "new",
      stepIndex: 0,
      dueAt: now.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as unknown as SrsEntry;
  }

  const opts = DEFAULT_DECK_OPTS;

  // Learning/Relearning flow mimicking Anki
  if (entry.stage === "new" || entry.stage === "learning") {
    // Treat as learning steps
    const steps = opts.learningStepsMinutes;
    let idx = entry.stepIndex ?? 0;
    if (rating === "again") {
      idx = 0;
      entry.stage = "learning";
      entry.stepIndex = idx;
      entry.dueAt = minutesFromNow(steps[idx]).toISOString();
    } else if (rating === "hard") {
      // repeat current step (average of again/good)
      entry.stage = "learning";
      entry.stepIndex = idx;
      entry.dueAt = minutesFromNow(
        steps[Math.min(idx, steps.length - 1)]
      ).toISOString();
    } else if (rating === "good") {
      if (idx < steps.length - 1) {
        idx += 1;
        entry.stage = "learning";
        entry.stepIndex = idx;
        entry.dueAt = minutesFromNow(steps[idx]).toISOString();
      } else {
        // graduate
        entry.stage = "review";
        entry.stepIndex = undefined;
        entry.intervalDays = opts.graduatingIntervalDays;
        entry.dueAt = addDays(now, entry.intervalDays).toISOString();
      }
    } else if (rating === "easy") {
      // immediate graduation to review with easy initial interval
      entry.stage = "review";
      entry.stepIndex = undefined;
      entry.intervalDays = opts.easyInitialIntervalDays;
      entry.dueAt = addDays(now, entry.intervalDays).toISOString();
    }
  } else if (entry.stage === "review") {
    // Review scheduling
    const efMin = opts.minEaseFactor;
    if (rating === "again") {
      // Lapse -> relearning
      entry.easeFactor = Math.max(efMin, entry.easeFactor - 0.2);
      entry.stage = "relearning";
      entry.prevIntervalDays = entry.intervalDays;
      entry.stepIndex = 0;
      const step = opts.relearnStepsMinutes[0] ?? 10;
      entry.dueAt = minutesFromNow(step).toISOString();
    } else if (rating === "hard") {
      entry.easeFactor = Math.max(efMin, entry.easeFactor - 0.15);
      entry.intervalDays = Math.max(
        1,
        Math.round(
          entry.intervalDays * opts.hardIntervalFactor * opts.intervalModifier
        )
      );
      entry.dueAt = addDays(now, entry.intervalDays).toISOString();
    } else if (rating === "good") {
      entry.intervalDays = Math.max(
        1,
        Math.round(
          entry.intervalDays * entry.easeFactor * opts.intervalModifier
        )
      );
      entry.dueAt = addDays(now, entry.intervalDays).toISOString();
    } else if (rating === "easy") {
      entry.easeFactor = entry.easeFactor + 0.15;
      entry.intervalDays = Math.max(
        1,
        Math.round(
          entry.intervalDays *
            entry.easeFactor *
            opts.easyBonus *
            opts.intervalModifier
        )
      );
      entry.dueAt = addDays(now, entry.intervalDays).toISOString();
    }
  } else if (entry.stage === "relearning") {
    // Relearning steps; after finishing, apply lapse new interval factor
    const steps = opts.relearnStepsMinutes;
    let idx = entry.stepIndex ?? 0;
    if (rating === "again") {
      idx = 0;
      entry.stepIndex = idx;
      entry.dueAt = minutesFromNow(steps[idx]).toISOString();
    } else if (rating === "hard") {
      // repeat current relearn step
      entry.stepIndex = idx;
      entry.dueAt = minutesFromNow(
        steps[Math.min(idx, steps.length - 1)]
      ).toISOString();
    } else if (rating === "good" || rating === "easy") {
      if (idx < steps.length - 1) {
        idx += 1;
        entry.stepIndex = idx;
        entry.dueAt = minutesFromNow(steps[idx]).toISOString();
      } else {
        // finish relearning -> back to review with new/lapse interval applied
        const prev = entry.prevIntervalDays ?? 1;
        const factor = rating === "easy" ? opts.easyBonus : 1.0;
        const newIvl = Math.max(
          1,
          Math.round(prev * opts.lapseNewIntervalFactor * factor)
        );
        entry.intervalDays = newIvl;
        entry.stage = "review";
        entry.stepIndex = undefined;
        entry.dueAt = addDays(now, entry.intervalDays).toISOString();
      }
    }
  }

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

export async function incrementDeckReviewStats(
  uid: string,
  deck: string
): Promise<void> {
  const ref = doc(db, "users", uid, "deckStats", deck);
  await setDoc(
    ref,
    {
      deck,
      totalReviews: increment(1),
      lastReviewedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// --- Accountability buddies ---
export async function getAccountabilityBuddies(uid: string): Promise<string[]> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return [];
  const d = snap.data() as any;
  const arr = d.buddies;
  return Array.isArray(arr)
    ? arr.filter((x: any) => typeof x === "string")
    : [];
}

export async function addAccountabilityBuddy(
  uid: string,
  buddyUid: string
): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, {
    buddies: arrayUnion(buddyUid),
    lastLoginAt: serverTimestamp(),
  });
}

export async function removeAccountabilityBuddy(
  uid: string,
  buddyUid: string
): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, {
    buddies: arrayRemove(buddyUid),
    lastLoginAt: serverTimestamp(),
  });
}
