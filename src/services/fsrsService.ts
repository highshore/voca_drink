import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit as qlimit,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Rating } from "./userService";
import { DEFAULT_FSRS_PARAMETERS } from "../fsrs/params";
import { schedule } from "../fsrs/scheduler";
import type {
  FsrsMemoryState,
  FsrsRating,
  FsrsParameters,
} from "../fsrs/types";

export type FsrsEntry = {
  deck: string;
  vocabId: string;
  state: FsrsMemoryState;
  nextIntervalDays: number;
  dueAt: string; // ISO timestamp
  createdAt?: any;
  updatedAt?: any;
};

function ratingToNumber(r: Rating): FsrsRating {
  switch (r) {
    case "again":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    default:
      return 3;
  }
}

export async function getFsrsMapForDeck(
  uid: string,
  deck: string
): Promise<Map<string, FsrsEntry>> {
  const snap = await getDocs(collection(db, "users", uid, "fsrs"));
  const map = new Map<string, FsrsEntry>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.deck === deck && typeof data.vocabId === "string") {
      map.set(data.vocabId, data as FsrsEntry);
    }
  });
  return map;
}

export async function getDueVocabIdsForDeck(
  uid: string,
  deck: string,
  maxCount = 50
): Promise<string[]> {
  const nowIso = new Date().toISOString();
  // Avoid composite index by ordering only; filter deck and due client-side
  const qref = query(
    collection(db, "users", uid, "fsrs"),
    orderBy("dueAt", "asc"),
    qlimit(500)
  );
  const snap = await getDocs(qref);
  const ids: string[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    if (
      data.deck === deck &&
      typeof data.vocabId === "string" &&
      data.dueAt <= nowIso
    ) {
      ids.push(data.vocabId);
    }
  });
  return ids.slice(0, maxCount);
}

export async function getUpcomingVocabIdsForDeck(
  uid: string,
  deck: string,
  maxCount = 50
): Promise<string[]> {
  const qref = query(
    collection(db, "users", uid, "fsrs"),
    orderBy("dueAt", "asc"),
    qlimit(500)
  );
  const snap = await getDocs(qref);
  const ids: string[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.deck === deck && typeof data.vocabId === "string")
      ids.push(data.vocabId);
  });
  return ids.slice(0, maxCount);
}

export async function countOverdueForDeck(
  uid: string,
  deck: string
): Promise<number> {
  const nowIso = new Date().toISOString();
  const qref = query(
    collection(db, "users", uid, "fsrs"),
    where("deck", "==", deck),
    where("dueAt", "<", nowIso)
  );
  const snap = await getDocs(qref);
  return snap.size;
}

export async function loadDueEntriesForDeck(
  uid: string,
  deck: string,
  maxCount = 50
): Promise<FsrsEntry[]> {
  const nowIso = new Date().toISOString();
  const qref = query(
    collection(db, "users", uid, "fsrs"),
    where("deck", "==", deck),
    where("dueAt", "<=", nowIso),
    orderBy("dueAt", "asc"),
    qlimit(maxCount)
  );
  const snap = await getDocs(qref);
  const list: FsrsEntry[] = [];
  snap.forEach((d) => list.push(d.data() as FsrsEntry));
  return list;
}

export async function forecastCountsNext7Days(
  uid: string,
  deck: string
): Promise<number[]> {
  const counts = new Array(7).fill(0);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  const qref = query(
    collection(db, "users", uid, "fsrs"),
    where("deck", "==", deck),
    where("dueAt", ">=", start.toISOString()),
    where("dueAt", "<", end.toISOString()),
    orderBy("dueAt", "asc")
  );
  const snap = await getDocs(qref);
  snap.forEach((d) => {
    const dueAt = new Date((d.data() as any).dueAt);
    const idx = Math.floor(
      (dueAt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  });
  return counts;
}

export async function medianStabilityOfDue(
  uid: string,
  deck: string
): Promise<number> {
  const entries = await loadDueEntriesForDeck(uid, deck, 200);
  const values = entries
    .map((e) => e.state.stability)
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
}

export async function difficultyBucketsOfDue(
  uid: string,
  deck: string
): Promise<{ low: number; mid: number; high: number }> {
  const entries = await loadDueEntriesForDeck(uid, deck, 200);
  let low = 0,
    mid = 0,
    high = 0;
  for (const e of entries) {
    const d = e.state.difficulty;
    if (d <= 4) low += 1;
    else if (d >= 7) high += 1;
    else mid += 1;
  }
  return { low, mid, high };
}

export async function getFsrsParametersForUser(
  uid: string
): Promise<FsrsParameters> {
  const pref = doc(db, "users", uid, "fsrs_params", "default");
  const psnap = await getDoc(pref);
  if (psnap.exists()) {
    const data = psnap.data() as any;
    const w: number[] = Array.isArray(data.w)
      ? data.w.map((x: any) => Number(x))
      : [];
    if (w.length === 17 && w.every((x) => Number.isFinite(x))) return { w };
  }
  return DEFAULT_FSRS_PARAMETERS;
}

export async function setFsrsParametersForUser(
  uid: string,
  params: FsrsParameters
): Promise<void> {
  const pref = doc(db, "users", uid, "fsrs_params", "default");
  await setDoc(
    pref,
    { w: params.w, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function updateFsrsOnAnswer(
  uid: string,
  deck: string,
  vocabId: string,
  rating: Rating,
  desiredRetention: number = 0.9
): Promise<FsrsEntry> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "fsrs", id);
  const snap = await getDoc(ref);

  const initialState: FsrsMemoryState = {
    stability: 0.01,
    difficulty: 5,
    lastReviewedAt: null,
    state: "new",
  };

  const prev: FsrsEntry | null = snap.exists()
    ? (snap.data() as FsrsEntry)
    : null;
  const state = prev?.state ?? initialState;
  const g = ratingToNumber(rating);
  const params = await getFsrsParametersForUser(uid);
  const res = schedule(state, g, desiredRetention, params);

  const entry: FsrsEntry = {
    deck,
    vocabId,
    state: res.newState,
    nextIntervalDays: res.nextIntervalDays,
    dueAt: res.nextDueAt,
    createdAt: prev?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, entry, { merge: true });
  return entry;
}

export async function ensureFsrsEntries(
  uid: string,
  deck: string,
  vocabIds: string[]
): Promise<number> {
  let created = 0;
  for (const vid of vocabIds) {
    const id = `${deck}:${vid}`;
    const ref = doc(db, "users", uid, "fsrs", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const nowIso = new Date().toISOString();
      const initial: FsrsEntry = {
        deck,
        vocabId: vid,
        state: {
          stability: 0.01,
          difficulty: 5,
          lastReviewedAt: null,
          state: "new",
        },
        nextIntervalDays: 0,
        dueAt: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as unknown as FsrsEntry;
      await setDoc(ref, initial, { merge: true });
      created += 1;
    }
  }
  return created;
}
