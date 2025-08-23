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
// Legacy SRS kept for backwards compatibility of types, but not used by Learn flow
export type SrsStage = "new" | "learning" | "review" | "relearning";
export type SrsEntry = {
  deck: string;
  vocabId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  stage: SrsStage;
  stepIndex?: number;
  prevIntervalDays?: number;
  lastReviewedAt?: string;
  createdAt?: any;
  updatedAt?: any;
};

// Legacy defaults removed (no longer used)

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

// function addDays(base: Date, days: number): Date {
//   const d = new Date(base.getTime());
//   d.setDate(d.getDate() + days);
//   return d;
// }

// function minutesFromNow(minutes: number): Date {
//   const d = new Date();
//   d.setMinutes(d.getMinutes() + minutes);
//   return d;
// }

export type Rating = "again" | "hard" | "good" | "easy";

export async function updateSrsOnAnswer(
  uid: string,
  deck: string,
  vocabId: string,
  _rating: Rating
): Promise<SrsEntry> {
  // No-op in new Leitner flow; keep function to avoid breaking imports.
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "srs", id);
  const now = new Date();
  const base: SrsEntry = {
    deck,
    vocabId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    stage: "new",
    dueAt: now.toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as unknown as SrsEntry;
  await setDoc(ref, base, { merge: true });
  return base;
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

// --- Bookmarks ---
export async function addBookmark(
  uid: string,
  deck: string,
  vocabId: string
): Promise<void> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "bookmarks", id);
  await setDoc(
    ref,
    { deck, vocabId, createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeBookmark(
  uid: string,
  deck: string,
  vocabId: string
): Promise<void> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "bookmarks", id);
  await deleteDoc(ref);
}

// --- Reports --- (user-generated content quality reports)
export async function submitReport(
  uid: string,
  deck: string,
  vocabId: string,
  reason?: string
): Promise<void> {
  const col = collection(db, "reports");
  await addDoc(col, {
    uid,
    deck,
    vocabId,
    reason: reason || null,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

// --- Per-deck preferences ---
export async function getDeckDailyGoal(
  uid: string,
  deck: string
): Promise<number | null> {
  try {
    // Preferred location: deckStats/{deck}
    const statsRef = doc(db, "users", uid, "deckStats", deck);
    const statsSnap = await getDoc(statsRef);
    if (statsSnap.exists()) {
      const d = statsSnap.data() as any;
      const g = Number(d.dailyGoal);
      if (Number.isFinite(g) && g > 0) return g;
    }
  } catch (_) {}
  // Backward compatibility: deckPrefs/{deck}
  try {
    const legacyRef = doc(db, "users", uid, "deckPrefs", deck);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const d = legacySnap.data() as any;
      const g = Number(d.dailyGoal);
      return Number.isFinite(g) && g > 0 ? g : null;
    }
  } catch (_) {}
  return null;
}

export async function setDeckDailyGoal(
  uid: string,
  deck: string,
  goal: number
): Promise<void> {
  const g = Math.max(1, Math.floor(Number(goal) || 0));
  const statsRef = doc(db, "users", uid, "deckStats", deck);
  await setDoc(
    statsRef,
    {
      deck,
      dailyGoal: g,
      updatedAt: serverTimestamp(),
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

// --- User Decks (My Decks) ---
export async function getUserDeckIds(uid: string): Promise<string[]> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return [];
  const d = snap.data() as any;
  const arr = d.myDecks;
  return Array.isArray(arr)
    ? arr.filter((x: any) => typeof x === "string")
    : [];
}

export async function addUserDeck(uid: string, deckId: string): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, {
    myDecks: arrayUnion(deckId),
    lastLoginAt: serverTimestamp(),
  });
}

export async function removeUserDeck(
  uid: string,
  deckId: string
): Promise<void> {
  const ref = userDocRef(uid);
  await updateDoc(ref, {
    myDecks: arrayRemove(deckId),
    lastLoginAt: serverTimestamp(),
  });
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
