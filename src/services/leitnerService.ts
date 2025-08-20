import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  limit as qlimit,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export type LeitnerEntry = {
  deck: string;
  vocabId: string;
  box: 1 | 2 | 3;
  dueAt: string; // ISO timestamp
  createdAt?: any;
  updatedAt?: any;
};

const BOX_INTERVAL_DAYS: Record<1 | 2 | 3, number> = {
  1: 1, // daily
  2: 3, // every 3 days
  3: 5, // every 5 days
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export async function getLeitnerMapForDeck(
  uid: string,
  deck: string
): Promise<Map<string, LeitnerEntry>> {
  const snap = await getDocs(collection(db, "users", uid, "leitner"));
  const map = new Map<string, LeitnerEntry>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.deck === deck && typeof data.vocabId === "string") {
      map.set(data.vocabId, data as LeitnerEntry);
    }
  });
  return map;
}

export async function ensureLeitnerEntries(
  uid: string,
  deck: string,
  vocabIds: string[]
): Promise<number> {
  let created = 0;
  for (const vid of vocabIds) {
    const id = `${deck}:${vid}`;
    const ref = doc(db, "users", uid, "leitner", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const nowIso = new Date().toISOString();
      const initial: LeitnerEntry = {
        deck,
        vocabId: vid,
        box: 1,
        dueAt: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as unknown as LeitnerEntry;
      await setDoc(ref, initial, { merge: true });
      created += 1;
    }
  }
  return created;
}

export async function getDueVocabIdsForDeck(
  uid: string,
  deck: string,
  maxCount = 50
): Promise<string[]> {
  const nowIso = new Date().toISOString();
  try {
    const qref = query(
      collection(db, "users", uid, "leitner"),
      where("deck", "==", deck),
      where("dueAt", "<=", nowIso),
      orderBy("dueAt", "asc"),
      qlimit(maxCount)
    );
    const snap = await getDocs(qref);
    const ids: string[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (typeof data.vocabId === "string") ids.push(data.vocabId);
    });
    return ids;
  } catch (_) {
    // Fallback without composite index: client-side filter/sort
    const snap = await getDocs(collection(db, "users", uid, "leitner"));
    const entries: any[] = [];
    snap.forEach((d) => entries.push(d.data()));
    return entries
      .filter((e) => e.deck === deck && typeof e.vocabId === "string")
      .filter((e) => typeof e.dueAt === "string" && e.dueAt <= nowIso)
      .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""))
      .slice(0, maxCount)
      .map((e) => e.vocabId as string);
  }
}

export async function getUpcomingVocabIdsForDeck(
  uid: string,
  deck: string,
  maxCount = 50
): Promise<string[]> {
  try {
    const qref = query(
      collection(db, "users", uid, "leitner"),
      where("deck", "==", deck),
      orderBy("dueAt", "asc"),
      qlimit(maxCount)
    );
    const snap = await getDocs(qref);
    const ids: string[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (typeof data.vocabId === "string") ids.push(data.vocabId);
    });
    return ids;
  } catch (_) {
    const snap = await getDocs(collection(db, "users", uid, "leitner"));
    const entries: any[] = [];
    snap.forEach((d) => entries.push(d.data()));
    return entries
      .filter((e) => e.deck === deck && typeof e.vocabId === "string")
      .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""))
      .slice(0, maxCount)
      .map((e) => e.vocabId as string);
  }
}

export async function updateLeitnerOnQuiz(
  uid: string,
  deck: string,
  vocabId: string,
  isCorrect: boolean
): Promise<LeitnerEntry> {
  const id = `${deck}:${vocabId}`;
  const ref = doc(db, "users", uid, "leitner", id);
  const snap = await getDoc(ref);
  const now = new Date();

  let entry: LeitnerEntry;
  if (snap.exists()) {
    entry = snap.data() as LeitnerEntry;
  } else {
    entry = {
      deck,
      vocabId,
      box: 1,
      dueAt: now.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as unknown as LeitnerEntry;
  }

  const prevBox = entry.box;
  const newBox = isCorrect
    ? (Math.min(3, (prevBox as number) + 1) as 1 | 2 | 3)
    : (Math.max(1, (prevBox as number) - 1) as 1 | 2 | 3);
  entry.box = newBox;
  const days = BOX_INTERVAL_DAYS[newBox];
  entry.dueAt = addDays(now, days).toISOString();
  // Persist exact fields to avoid accidentally persisting TS-only fields
  const payload = {
    deck: entry.deck,
    vocabId: entry.vocabId,
    box: entry.box,
    dueAt: entry.dueAt,
    createdAt: snap.exists()
      ? snap.data()?.createdAt ?? serverTimestamp()
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any;
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload, { merge: true });
  }
  return entry;
}

export async function countDueForDeck(
  uid: string,
  deck: string
): Promise<number> {
  const nowIso = new Date().toISOString();
  try {
    const qref = query(
      collection(db, "users", uid, "leitner"),
      where("deck", "==", deck),
      where("dueAt", "<=", nowIso)
    );
    const snap = await getDocs(qref);
    return snap.size;
  } catch (_) {
    const snap = await getDocs(collection(db, "users", uid, "leitner"));
    let n = 0;
    snap.forEach((d) => {
      const e = d.data() as any;
      if (e.deck === deck && typeof e.dueAt === "string" && e.dueAt <= nowIso) {
        n += 1;
      }
    });
    return n;
  }
}

export async function getBoxIds(
  uid: string,
  deck: string,
  box: 1 | 2 | 3,
  maxCount = 30
): Promise<string[]> {
  try {
    const qref = query(
      collection(db, "users", uid, "leitner"),
      where("deck", "==", deck),
      where("box", "==", box),
      orderBy("dueAt", "asc"),
      qlimit(maxCount)
    );
    const snap = await getDocs(qref);
    const ids: string[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (typeof data.vocabId === "string") ids.push(data.vocabId);
    });
    return ids;
  } catch (_) {
    const snap = await getDocs(collection(db, "users", uid, "leitner"));
    const entries: any[] = [];
    snap.forEach((d) => entries.push(d.data()));
    return entries
      .filter(
        (e) => e.deck === deck && (e.box === box || Number(e.box) === box)
      )
      .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""))
      .slice(0, maxCount)
      .map((e) => e.vocabId as string);
  }
}
