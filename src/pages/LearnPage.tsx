import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  onSnapshot,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  incrementReviewStats,
  setUserCurrentDeck,
  recordReviewEvent,
  updateUserLastReview,
  incrementDeckReviewStats,
  getDeckDailyGoal,
  setDeckDailyGoal,
  type Rating,
} from "../services/userService";
import { useLocation, useNavigate } from "react-router-dom";
import { s, colors } from "../ui/layout";
import { AnimatedEmoji, emojiCode } from "../ui/AnimatedEmoji";
import {
  PageGrid,
  CardWrap,
  Panel,
  KanaRow,
  Kana,
  Kanji,
} from "./learn/Styles";
import { StatsPanel } from "./learn/StatsPanel";
import { QuizCard } from "./learn/QuizCard";
import { getDeckMetadata } from "../services/deckService";
import {
  getTodayRatingDistribution,
  get7DayRetention,
} from "../services/reviewStatsService";
// Replace FSRS with Leitner
import {
  updateLeitnerOnQuiz,
  ensureLeitnerEntries,
  countDueForDeck,
  getBoxIds,
  getLeitnerMapForDeck,
  selectVocabIdsByFrequency,
} from "../services/leitnerService";

import { UniversalLoader } from "../components/UniversalLoader";
import { useI18n } from "../i18n/I18nContext";
import {
  addBookmark,
  removeBookmark,
  submitReport,
} from "../services/userService";

type JapaneseDoc = {
  id?: string;
  kana: string;
  kanji: string;
  meanings: { ko: string };
  tags: string[];
  examples?: Array<{
    sentence?: string;
    pronunciation?: string;
    translation?: { ko?: string };
  }>;
};

type McqQuiz =
  | {
      type: "mcq"; // meaning -> choose correct meaning for kana/kanji
      cardId: string;
      prompt: string;
      options: Array<{ text: string; isCorrect: boolean }>;
    }
  | {
      type: "rev"; // reverse: meaning shown -> select the correct word (kana + optional kanji)
      cardId: string;
      prompt: string; // the meaning text
      options: Array<{ text: string; isCorrect: boolean }>;
    };

// (unused) legacy session learning constants removed for Leitner

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Batch fetch vocabulary documents to avoid multiple individual queries
async function batchFetchVocabDocs(
  deck: string,
  vocabIds: string[]
): Promise<JapaneseDoc[]> {
  if (vocabIds.length === 0) return [];

  const docs: JapaneseDoc[] = [];
  // Firebase has a limit of 10 documents per 'in' query, so we need to batch
  const BATCH_SIZE = 10;

  for (let i = 0; i < vocabIds.length; i += BATCH_SIZE) {
    const batch = vocabIds.slice(i, i + BATCH_SIZE);
    try {
      const q = query(collection(db, deck), where(documentId(), "in", batch));
      const snap = await getDocs(q);
      snap.forEach((doc) => {
        if (doc.exists()) {
          docs.push({ id: doc.id, ...(doc.data() as any) });
        }
      });
    } catch (error) {
      console.error("Error in batch fetch:", error);
      // Fallback to individual queries for this batch
      for (const id of batch) {
        try {
          const docRef = doc(db, deck, id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            docs.push({ id, ...(docSnap.data() as any) });
          }
        } catch (_) {
          // Skip failed individual docs
        }
      }
    }
  }

  return docs;
}

function buildMcqFor(
  target: JapaneseDoc,
  candidates: JapaneseDoc[]
): McqQuiz | null {
  const targetMeaning = (target.meanings?.ko || "").trim();
  if (!targetMeaning) return null;
  const distractors = candidates
    .filter((c) => c.id !== target.id)
    .filter(
      (c) =>
        (c.meanings?.ko || "").trim() &&
        (c.meanings?.ko || "").trim() !== targetMeaning
    );
  if (distractors.length < 4) return null;
  const chosen = shuffleArray(distractors).slice(0, 4);
  const forward: McqQuiz = {
    type: "mcq",
    cardId: target.id!,
    prompt: `Choose the meaning for: ${target.kana}${
      target.kanji && target.kanji !== target.kana ? ` (${target.kanji})` : ""
    }`,
    options: shuffleArray([
      { text: targetMeaning, isCorrect: true },
      ...chosen.map((d) => ({
        text: (d.meanings?.ko || "").trim(),
        isCorrect: false,
      })),
    ]),
  };

  // Build reverse quiz: show meaning -> choose correct word
  const wordOf = (d: JapaneseDoc) =>
    `${d.kana}${d.kanji && d.kanji !== d.kana ? ` (${d.kanji})` : ""}`;
  const reverse: McqQuiz = {
    type: "rev",
    cardId: target.id!,
    prompt: `Which word matches: ${targetMeaning}?`,
    options: shuffleArray([
      { text: wordOf(target), isCorrect: true },
      ...chosen.map((d) => ({ text: wordOf(d), isCorrect: false })),
    ]),
  };

  // 50/50 choose forward or reverse
  return Math.random() < 0.5 ? forward : reverse;
}

function buildTranslationFor(item: JapaneseDoc): {
  promptKo: string;
  tokens: string[];
  blankLabel: string;
  maskedSentence: string;
} | null {
  const examples = Array.isArray(item.examples) ? item.examples : [];
  const ex = examples.find(
    (e) => (e as any)?.translation?.ko && (e as any)?.sentence
  ) as any;
  if (!ex) return null;
  const promptKo = (ex.translation?.ko || "").trim();
  const jpSentence = String(ex.sentence || "").trim();
  if (!promptKo || !jpSentence) return null;
  const needle = (item.kanji || item.kana || "").trim();
  if (!needle) return null;

  let blankSub = "";
  if (item.kanji && jpSentence.includes(item.kanji)) blankSub = item.kanji;
  else if (item.kana && jpSentence.includes(item.kana)) blankSub = item.kana;
  else {
    const mid = Math.max(0, Math.floor(jpSentence.length / 2) - 1);
    blankSub = jpSentence.slice(mid, mid + 2) || jpSentence.slice(0, 2);
  }

  const withBlank = jpSentence.replace(blankSub, "____");
  const punctSplit = withBlank
    .split(/([、。！!？?，,．\.\s]+)/)
    .filter((t) => t && !/^[\s]+$/.test(t));
  let tokens: string[] = [];
  if (punctSplit.length > 1) {
    for (let i = 0; i < punctSplit.length; i++) {
      const t = punctSplit[i];
      if (/^[、。！!？?，,．\.]$/.test(t) && tokens.length > 0) {
        tokens[tokens.length - 1] = tokens[tokens.length - 1] + t;
      } else if (!/^\s+$/.test(t)) {
        tokens.push(t);
      }
    }
  } else {
    for (let i = 0; i < withBlank.length; i += 4) {
      tokens.push(withBlank.slice(i, i + 4));
    }
  }
  tokens = shuffleArray(tokens);
  if (!tokens.some((t) => t.includes("____"))) {
    tokens.push("____");
  }
  return { promptKo, tokens, blankLabel: blankSub, maskedSentence: withBlank };
}

export function LearnPage() {
  const { t } = useI18n();
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<JapaneseDoc[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  // no reveal state in quiz-only flow
  const [daily, setDaily] = useState<{
    reviewsToday: number;
    streakDays: number;
  }>({ reviewsToday: 0, streakDays: 0 });
  const [deckTotal, setDeckTotal] = useState<number>(0);
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [stats, setStats] = useState<{
    dueNow: number;
    overdue: number;
    remainingToday: number;
    todayAccuracy: number;
    todayMix: { again: number; hard: number; good: number; easy: number };
    retention7d: number;
    medianStability: number;
    difficultyMix: { low: number; mid: number; high: number };
    forecast7d: number[];
  }>({
    dueNow: 0,
    overdue: 0,
    remainingToday: 0,
    todayAccuracy: 0,
    todayMix: { again: 0, hard: 0, good: 0, easy: 0 },
    retention7d: 0,
    medianStability: 0,
    difficultyMix: { low: 0, mid: 0, high: 0 },
    forecast7d: [],
  });
  const [surprisePool, setSurprisePool] = useState<JapaneseDoc[]>([]);
  const [quiz, setQuiz] = useState<McqQuiz | null>(null);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [translation, setTranslation] = useState<{
    promptKo: string;
    tokens: string[];
    blankLabel: string;
    maskedSentence?: string;
  } | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>("");
  // result is derived at selection time; no separate state needed
  const [feedback, setFeedback] = useState<{
    key: string;
    code: string;
    until: number;
    top?: number;
    left?: number;
  } | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceTimer = useRef<number | null>(null);
  const currentRef = useRef<number>(0);
  const leitnerMapRef = useRef<Map<string, { box: 1 | 2 | 3 }>>(new Map());
  const lastReplanAtRef = useRef<number>(0);
  const [phase, setPhase] = useState<"quiz" | "emoji" | "meaning">("quiz");
  const deckRef = useRef<string>("japanese");
  const QUIZ_TIMEOUT_MS = 8000;
  const TRANSLATION_TIMEOUT_MS = 40000;
  const [quizEndsAt, setQuizEndsAt] = useState<number | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(10);
  const [timerTotalSec, setTimerTotalSec] = useState<number>(10);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [isReported, setIsReported] = useState<boolean>(false);

  // auto-clear feedback overlay
  useEffect(() => {
    if (!feedback) return;
    const ms = Math.max(0, feedback.until - Date.now());
    const id = window.setTimeout(() => setFeedback(null), ms);
    return () => window.clearTimeout(id);
  }, [feedback]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // no in-session relearn/insert with Leitner

  function advanceAfter(ms: number) {
    setIsAdvancing(true);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      setCurrent((n) => (n + 1) % Math.max(1, items.length));
      // Clear any feedback state when moving on
      setQuizSelected(null);
      setFeedback(null);
      setPhase("quiz");
      setIsAdvancing(false);
    }, Math.max(0, ms));
  }

  async function refreshLeitnerBoxes() {
    if (!user) return;
    try {
      const [b1, b2, b3] = await Promise.all([
        getBoxIds(user.uid, deckRef.current, 1, 30),
        getBoxIds(user.uid, deckRef.current, 2, 30),
        getBoxIds(user.uid, deckRef.current, 3, 30),
      ]);
      const nameOf = async (vid: string): Promise<string> => {
        try {
          const ref = doc(db, deckRef.current, vid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data() as any;
            return `${d.kana}${
              d.kanji && d.kanji !== d.kana ? ` (${d.kanji})` : ""
            }`;
          }
        } catch (_) {}
        return vid;
      };
      const [w1, w2, w3] = await Promise.all([
        Promise.all(b1.slice(0, 30).map(nameOf)),
        Promise.all(b2.slice(0, 30).map(nameOf)),
        Promise.all(b3.slice(0, 30).map(nameOf)),
      ]);
      setBox1Words(w1);
      setBox2Words(w2);
      setBox3Words(w3);
    } catch (_) {}
  }

  // 10s timeout when in quiz phase and no selection
  const quizTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (quizTimeoutRef.current) {
      window.clearTimeout(quizTimeoutRef.current);
      quizTimeoutRef.current = null;
    }
    const item = items[current];
    if (!item || phase !== "quiz" || quizSelected !== null || isPageLoading)
      return;
    // start per-question countdown
    // Use 30s for Box 3 translation tasks
    const isBox3 = (() => {
      try {
        const eid = item.id;
        if (!eid) return false;
        const entry = (
          leitnerMapRef.current as any as Map<string, { box: 1 | 2 | 3 }>
        ).get(eid);
        return (entry?.box || 1) === 3;
      } catch (_) {
        return false;
      }
    })();
    const timeoutMs = isBox3 ? TRANSLATION_TIMEOUT_MS : QUIZ_TIMEOUT_MS;
    const ends = Date.now() + timeoutMs;
    setQuizEndsAt(ends);
    setTimerTotalSec(timeoutMs / 1000);
    setTimeLeftSec(timeoutMs / 1000);
    quizTimeoutRef.current = window.setTimeout(() => {
      if (phase !== "quiz" || quizSelected !== null) return;
      // mark incorrect, go to emoji then meaning
      setQuizEndsAt(null);
      setQuizSelected(-1 as any);
      setPhase("emoji");
      setFeedback({
        key: `${Date.now()}`,
        code: emojiCode("fail"),
        until: Date.now() + 1000,
      });
      (async () => {
        if (!user || !item.id) return;
        try {
          await incrementReviewStats(user.uid);
        } catch (_) {}
        try {
          await recordReviewEvent(user.uid, deckRef.current, item.id, "again");
          await updateUserLastReview(
            user.uid,
            deckRef.current,
            item.id,
            "again"
          );
          await incrementDeckReviewStats(user.uid, deckRef.current);
        } catch (_) {}
        try {
          await updateLeitnerOnQuiz(user.uid, deckRef.current, item.id, false);
        } catch (_) {}
        try {
          // optimistic local update of box chips
          try {
            const map = leitnerMapRef.current || new Map();
            const prev = (map.get(item.id) as any)?.box ?? 1;
            const next: 1 | 2 | 3 = Math.max(
              1,
              Math.min(3, (Number(prev) || 1) - 1)
            ) as 1 | 2 | 3;
            map.set(item.id, { box: next } as any);
            leitnerMapRef.current = map as any;
            const ids1: string[] = [];
            const ids2: string[] = [];
            const ids3: string[] = [];
            (map as any as Map<string, { box: 1 | 2 | 3 }>).forEach((v, k) => {
              if (v.box === 1) ids1.push(k);
              else if (v.box === 2) ids2.push(k);
              else ids3.push(k);
            });
            const nameOf = async (vid: string): Promise<string> => {
              try {
                const ref = doc(db, deckRef.current, vid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                  const d = snap.data() as any;
                  const word = `${d.kana}${
                    d.kanji && d.kanji !== d.kana ? ` (${d.kanji})` : ""
                  }`;
                  return word;
                }
              } catch (_) {}
              return vid;
            };
            const [w1, w2, w3] = await Promise.all([
              Promise.all(ids1.slice(0, 30).map(nameOf)),
              Promise.all(ids2.slice(0, 30).map(nameOf)),
              Promise.all(ids3.slice(0, 30).map(nameOf)),
            ]);
            setBox1Words(w1);
            setBox2Words(w2);
            setBox3Words(w3);
          } catch (_) {}
        } catch (_) {}
        try {
          await refreshLeitnerBoxes();
        } catch (_) {}
      })();
      window.setTimeout(() => {
        setFeedback(null);
        setPhase("meaning");
      }, 1000);
    }, timeoutMs) as any;
    return () => {
      if (quizTimeoutRef.current) window.clearTimeout(quizTimeoutRef.current);
      quizTimeoutRef.current = null;
      setQuizEndsAt(null);
    };
  }, [items, current, phase, quizSelected, user, isPageLoading]);

  // Update timer progress for quiz
  useEffect(() => {
    if (quizEndsAt == null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, (quizEndsAt - Date.now()) / 1000);
      setTimeLeftSec(left);
      if (left <= 0) {
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [quizEndsAt]);

  // Keyboard: when quiz open -> 1..4 selects option; four-choice rating disabled
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't handle keyboard events while page is still loading
      if (isPageLoading) return;

      if (phase === "meaning" && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        setFeedback(null);
        advanceAfter(0);
      }
      // numeric keys selection while in quiz
      if (
        phase === "quiz" &&
        quiz &&
        ["1", "2", "3", "4", "5"].includes(e.key)
      ) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        if (idx < 0 || idx >= 5) return;
        if (isAdvancing || quizSelected !== null) return;
        setQuizEndsAt(null);
        setQuizSelected(idx);
        setPhase("emoji");
        const isCorrect = !!quiz.options[idx]?.isCorrect;
        setFeedback({
          key: `${Date.now()}`,
          code: isCorrect ? emojiCode("success") : emojiCode("fail"),
          until: Date.now() + 1000,
        });
        const item = items[current];
        (async () => {
          if (!user || !item?.id) return;
          try {
            await incrementReviewStats(user.uid);
          } catch (_) {}
          try {
            await recordReviewEvent(
              user.uid,
              deckRef.current,
              item.id,
              isCorrect ? ("good" as Rating) : ("again" as Rating)
            );
            await updateUserLastReview(
              user.uid,
              deckRef.current,
              item.id,
              isCorrect ? ("good" as Rating) : ("again" as Rating)
            );
            await incrementDeckReviewStats(user.uid, deckRef.current);
          } catch (_) {}
          try {
            await updateLeitnerOnQuiz(
              user.uid,
              deckRef.current,
              item.id,
              isCorrect
            );
          } catch (_) {}
          try {
          } catch (_) {}
          try {
            await refreshLeitnerBoxes();
          } catch (_) {}
        })();
        window.setTimeout(() => {
          setFeedback(null);
          setPhase("meaning");
        }, 1000);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    phase,
    quiz,
    isAdvancing,
    quizSelected,
    user,
    items,
    current,
    isPageLoading,
  ]);

  // responsive layout handled by CSS in PageGrid
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const deck = params.get("deck") || "japanese";
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  // no JS resize listener needed; styles are responsive

  const [deckTitle, setDeckTitle] = useState<string>("");
  // Removed sample word chips for boxes to avoid fallback displays
  const setBox1Words = (() => (_: string[]) => {}) as unknown as React.Dispatch<
    React.SetStateAction<string[]>
  >;
  const setBox2Words = (() => (_: string[]) => {}) as unknown as React.Dispatch<
    React.SetStateAction<string[]>
  >;
  const setBox3Words = (() => (_: string[]) => {}) as unknown as React.Dispatch<
    React.SetStateAction<string[]>
  >;
  const [boxCounts, setBoxCounts] = useState<{
    box1: number;
    box2: number;
    box3: number;
  }>({ box1: 0, box2: 0, box3: 0 });
  const headline = useMemo(() => {
    if (isLoading) return "Loading";
    const base = user ? "Your queue" : "Public queue";
    return deckTitle ? `${deckTitle}` : `${base}`;
  }, [isLoading, user, deckTitle]);

  useEffect(() => {
    if (!user) return;
    const qref = query(
      collection(db, "users", user.uid, "leitner"),
      where("deck", "==", deck)
    );
    const unsub = onSnapshot(qref, (snap) => {
      try {
        const ids1: string[] = [];
        const ids2: string[] = [];
        const ids3: string[] = [];
        let dueCount = 0;
        const nowIso = new Date().toISOString();
        const m = new Map<string, { box: 1 | 2 | 3 }>();

        snap.forEach((d) => {
          const e = d.data() as any;
          const vid = e.vocabId as string;
          const box = (Number(e.box) || 1) as 1 | 2 | 3;
          if (typeof vid !== "string") return;
          if (box === 1) ids1.push(vid);
          else if (box === 2) ids2.push(vid);
          else ids3.push(vid);
          if (typeof e.dueAt === "string" && e.dueAt <= nowIso) dueCount += 1;
          m.set(vid, { box });
        });

        // Update due count and map ref synchronously
        setStats((prev) => ({ ...prev, dueNow: dueCount }));
        leitnerMapRef.current = m as any;
        setBoxCounts({
          box1: ids1.length,
          box2: ids2.length,
          box3: ids3.length,
        });

        // If any box overflows capacity, replan session immediately using Fibonacci weights
        const capacities = { 1: 200, 2: 120, 3: 80 } as const;
        const overflow =
          ids1.length > capacities[1] ||
          ids2.length > capacities[2] ||
          ids3.length > capacities[3];
        const nowTs = Date.now();
        if (overflow && nowTs - (lastReplanAtRef.current || 0) > 10000) {
          lastReplanAtRef.current = nowTs;
          (async () => {
            try {
              const sessionIds = await selectVocabIdsByFrequency(
                user.uid,
                deck,
                100,
                {
                  sessionSize: 100,
                  weights: { 1: 13, 2: 8, 3: 5 },
                  capacities,
                  preferDue: true,
                }
              );
              if (sessionIds && sessionIds.length > 0) {
                const docs = await batchFetchVocabDocs(
                  deck,
                  sessionIds.slice(0, 50)
                );
                if (docs.length > 0) {
                  setItems(docs);
                  setCurrent(0);
                }
              }
            } catch (_) {}
          })();
        }

        // Removed sampling of box word names to avoid showing fallback lists
      } catch (_) {}
    });
    return () => unsub();
  }, [user, deck]);
  useEffect(() => {
    async function load() {
      setIsPageLoading(true);
      setError(null);

      try {
        if (user) {
          // Parallelize all initial data loading
          const [userDoc, deckMeta, seedIds] = await Promise.all([
            // Load user data
            (async () => {
              await setUserCurrentDeck(user.uid, deck);
              const uref = doc(db, "users", user.uid);
              const usnap = await getDoc(uref);
              return usnap.exists() ? (usnap.data() as any) : null;
            })(),
            // Load deck metadata
            getDeckMetadata(deck).catch(() => null),
            // Get seed IDs for Leitner entries
            (async () => {
              const seedQuery = query(
                collection(db, deck),
                orderBy("kana"),
                limit(100)
              );
              const seedSnap = await getDocs(seedQuery);
              const ids: string[] = [];
              seedSnap.forEach((d) => {
                if (!["metadata", "meta", "_meta", "__meta__"].includes(d.id)) {
                  ids.push(d.id);
                }
              });
              return ids;
            })(),
          ]);

          // Set user data and deck-specific daily goal
          if (userDoc) {
            setDaily({
              reviewsToday: Number(userDoc.reviewsToday || 0),
              streakDays: Number(userDoc.streakDays || 0),
            });
          }

          // Set deck metadata
          if (deckMeta) {
            setDeckTitle(deckMeta.name || deckMeta.title || deck);
            setDeckTotal(deckMeta.count);
          }

          // Ensure Leitner entries and get vocab to study
          await ensureLeitnerEntries(user.uid, deck, seedIds);

          // Get stats and plan session IDs using Fibonacci-weighted selection
          const [sessionIds, statsData] = await Promise.all([
            selectVocabIdsByFrequency(user.uid, deck, 100, {
              sessionSize: 100,
              weights: { 1: 13, 2: 8, 3: 5 },
              capacities: { 1: 200, 2: 120, 3: 80 },
              preferDue: true,
            }),
            Promise.all([
              getTodayRatingDistribution(user.uid, deck),
              get7DayRetention(user.uid, deck),
              countDueForDeck(user.uid, deck),
              getBoxIds(user.uid, deck, 1, 30),
              getBoxIds(user.uid, deck, 2, 30),
              getBoxIds(user.uid, deck, 3, 30),
              getLeitnerMapForDeck(user.uid, deck),
            ]),
          ]);
          const idsToFetch = sessionIds;

          // Parallelize vocab and surprise pool loading
          const [vocabDocs, surprisePoolDocs] = await Promise.all([
            // Load vocab documents using batch fetch
            batchFetchVocabDocs(deck, idsToFetch.slice(0, 50)),
            // Load surprise pool
            (async () => {
              try {
                const rcol = collection(db, "users", user.uid, "reviews");
                const rsnap = await getDocs(
                  query(rcol, orderBy("createdAt", "desc"), limit(500))
                );
                const ids = new Set<string>();
                rsnap.forEach((d) => {
                  const data = d.data() as any;
                  if (
                    data.deck === deck &&
                    (data.rating === "good" || data.rating === "easy")
                  ) {
                    if (typeof data.vocabId === "string") ids.add(data.vocabId);
                  }
                });
                return batchFetchVocabDocs(deck, Array.from(ids).slice(0, 100));
              } catch {
                return [];
              }
            })(),
          ]);

          // Load deck-specific daily goal (fallback to 20 if missing)
          try {
            const dg = await getDeckDailyGoal(user.uid, deck);
            setDailyGoal(Number(dg ?? 20));
          } catch (_) {
            setDailyGoal(20);
          }

          // Process stats data
          const [mix, retention, dueCount, b1, b2, b3, lmap] = statsData;
          const totalToday = mix.again + mix.hard + mix.good + mix.easy;
          const todayAccuracy =
            totalToday > 0 ? (mix.hard + mix.good + mix.easy) / totalToday : 0;

          setStats((prev) => ({
            ...prev,
            dueNow: dueCount,
            overdue: 0,
            todayMix: mix,
            todayAccuracy,
            retention7d: retention,
            forecast7d: [],
            medianStability: 0,
            difficultyMix: { low: 0, mid: 0, high: 0 },
          }));

          // Batch load box words
          const nameOf = async (vid: string): Promise<string> => {
            try {
              const ref = doc(db, deck, vid);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                const d = snap.data() as any;
                return `${d.kana}${
                  d.kanji && d.kanji !== d.kana ? ` (${d.kanji})` : ""
                }`;
              }
            } catch (_) {}
            return vid;
          };

          const [w1, w2, w3] = await Promise.all([
            Promise.all(b1.slice(0, 30).map(nameOf)),
            Promise.all(b2.slice(0, 30).map(nameOf)),
            Promise.all(b3.slice(0, 30).map(nameOf)),
          ]);

          setBox1Words(w1);
          setBox2Words(w2);
          setBox3Words(w3);

          // Set up Leitner map
          const m = new Map<string, { box: 1 | 2 | 3 }>();
          (lmap as any as Map<string, any>).forEach(
            (entry: any, vid: string) => {
              m.set(vid, { box: (entry.box as 1 | 2 | 3) ?? 1 });
            }
          );
          leitnerMapRef.current = m as any;

          // Set the vocabulary items and surprise pool
          if (vocabDocs.length > 0) {
            setItems(vocabDocs);
            setSurprisePool(surprisePoolDocs);

            // Ensure Leitner entries for loaded docs
            await ensureLeitnerEntries(
              user.uid,
              deck,
              vocabDocs.map((d) => d.id!).filter(Boolean)
            );
          } else {
            // Fallback to loading regular vocab list
            const q = query(collection(db, deck), orderBy("kana"), limit(50));
            const snap = await getDocs(q);
            const list: JapaneseDoc[] = [];
            snap.forEach((d) => {
              if (!["metadata", "meta", "_meta", "__meta__"].includes(d.id)) {
                list.push({ id: d.id, ...(d.data() as any) });
              }
            });
            setItems(list);
            setSurprisePool(surprisePoolDocs);

            if (list.length > 0) {
              await ensureLeitnerEntries(
                user.uid,
                deck,
                list.map((d) => d.id!).filter(Boolean)
              );
            }
          }
        } else {
          // Guest user fallback
          const q = query(collection(db, deck), orderBy("kana"), limit(50));
          const snap = await getDocs(q);
          const list: JapaneseDoc[] = [];
          snap.forEach((d) => {
            if (!["metadata", "meta", "_meta", "__meta__"].includes(d.id)) {
              list.push({ id: d.id, ...(d.data() as any) });
            }
          });
          setItems(list);
        }
      } catch (e: any) {
        console.error("Error loading learn page:", e);
        setError(e?.message || "Failed to load deck.");
        setItems([]);
      } finally {
        setIsPageLoading(false);
      }
    }

    load();
  }, [deck, navigate, user]);

  // After items/current load, build a quiz if needed
  useEffect(() => {
    const base = items[current];
    if (!base || isPageLoading) return;
    // If item is in box 3 and has examples, build translation task; else MCQ
    const entry = base.id
      ? (leitnerMapRef.current as any as Map<string, { box: 1 | 2 | 3 }>).get(
          base.id
        )
      : null;
    const isBox3 = (entry?.box || 1) === 3;
    if (isBox3) {
      const tr = buildTranslationFor(base);
      if (tr) {
        setTranslation(tr);
        setTypedAnswer("");
        setQuiz(null);
        setQuizSelected(null);
        return;
      }
    }
    setTranslation(null);
    const pool = items.length >= 5 ? items : [...items, ...surprisePool];
    const q = buildMcqFor(base, pool);
    if (q && (phase === "quiz" || !quiz)) {
      setQuiz(q);
      setQuizSelected(null);
    }
  }, [items, current, surprisePool, phase, isPageLoading]);

  // Track bookmark/report state for the current item
  useEffect(() => {
    (async () => {
      try {
        setIsBookmarked(false);
        setIsReported(false);
        const item = items[current];
        if (!user || !item?.id) return;
        const id = `${deckRef.current}:${item.id}`;
        try {
          const ref = doc(db, "users", user.uid, "bookmarks", id);
          const snap = await getDoc(ref);
          if (snap.exists()) setIsBookmarked(true);
        } catch (_) {}
        // Optional: you could also check if user previously reported this item (not stored per-user now)
      } catch (_) {}
    })();
  }, [items, current, user]);

  // no reveal behavior in quiz-only flow

  // Show loading screen until everything is ready
  if (isLoading || isPageLoading) {
    return <UniversalLoader messageKey="common.loadingSession" />;
  }

  return (
    <div style={{ ...s.container }}>
      <h2
        style={{
          margin: 0,
          marginBottom: 20,
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: colors.text,
        }}
      >
        {headline}
      </h2>
      {error && (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderLeft: `4px solid ${colors.brand}`,
            borderRadius: 12,
            padding: 12,
            background: "#fff7ed",
            color: "#9a3412",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}
      <PageGrid>
        <CardWrap>
          {/* Top-right actions */}
          {phase === "meaning" && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                gap: 12,
                zIndex: 6,
              }}
            >
              <button
                aria-label="Bookmark"
                onClick={async () => {
                  const item = items[current];
                  if (!item?.id) return;
                  if (!user) {
                    try {
                      window.alert(t("nav.signInShort"));
                    } catch (_) {}
                    return;
                  }
                  const next = !isBookmarked;
                  setIsBookmarked(next); // optimistic
                  try {
                    if (next) {
                      await addBookmark(user.uid, deckRef.current, item.id);
                    } else {
                      await removeBookmark(user.uid, deckRef.current, item.id);
                    }
                  } catch (_) {
                    // revert on failure
                    setIsBookmarked(!next);
                  }
                }}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
                title={isBookmarked ? "Remove bookmark" : "Save bookmark"}
              >
                {isBookmarked ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="20"
                    height="20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    width="20"
                    height="20"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                    />
                  </svg>
                )}
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {t("ui.save")}
                </div>
              </button>
              <button
                aria-label="Report"
                onClick={async () => {
                  const item = items[current];
                  if (!item?.id) return;
                  if (!user) {
                    try {
                      window.alert(t("nav.signInShort"));
                    } catch (_) {}
                    return;
                  }
                  const reason =
                    window.prompt("Report reason? (optional)") || undefined;
                  try {
                    await submitReport(
                      user.uid,
                      deckRef.current,
                      item.id,
                      reason
                    );
                    setIsReported(true);
                    setFeedback({
                      key: `${Date.now()}`,
                      code: emojiCode("success"),
                      until: Date.now() + 800,
                    });
                  } catch (_) {
                    setIsReported(false);
                  }
                }}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
                title="Report issue"
              >
                {isReported ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="20"
                    height="20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054A8.25 8.25 0 0 0 18 4.524l3.11-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-2.202.55V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    width="20"
                    height="20"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
                    />
                  </svg>
                )}
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {t("ui.report")}
                </div>
              </button>
            </div>
          )}

          {/* Overlay feedback emoji */}
          {feedback && feedback.until > Date.now() && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              <AnimatedEmoji codepoint={feedback.code} size={120} />
            </div>
          )}
          {isAdvancing ? (
            <Panel style={{ minHeight: 420 }} />
          ) : phase === "emoji" ? (
            <Panel style={{ minHeight: 420 }} />
          ) : phase === "meaning" ? (
            (() => {
              const base = items[current] || ({} as JapaneseDoc);
              const pool =
                items.length >= 4 ? items : [...items, ...surprisePool];
              const isKanaDeck = deckRef.current === "japanese_kana";
              if (isKanaDeck) {
                const it = items[current];
                if (!it) return <Panel style={{ minHeight: 420 }} />;
                const hasKanji = it.kanji && it.kanji !== it.kana;
                return (
                  <Panel style={{ minHeight: 420 }}>
                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                        }}
                      >
                        <KanaRow>
                          <Kana>{it.kana}</Kana>
                          {hasKanji && <Kanji>{it.kanji}</Kanji>}
                        </KanaRow>
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {it.meanings?.ko}
                        </div>
                        {it.examples && it.examples.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            {it.examples.map((ex, i) => (
                              <div
                                key={i}
                                style={{
                                  color: "#334155",
                                  textAlign: "center",
                                  padding: 16,
                                  background: "#f8fafc",
                                  borderRadius: 12,
                                  border: `1px solid ${colors.border}`,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "1.125rem",
                                    marginBottom: 4,
                                  }}
                                >
                                  {ex.sentence}
                                </div>
                                <div style={{ fontSize: "1rem" }}>
                                  {ex.translation?.ko}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            marginTop: 12,
                          }}
                        >
                          <button
                            onClick={() => {
                              setFeedback(null);
                              advanceAfter(0);
                            }}
                            style={{
                              ...s.button,
                              ...s.buttonBrand,
                              fontSize: "1rem",
                              padding: "10px 16px",
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </Panel>
                );
              }
              const q = buildMcqFor(base, pool);
              if (!q) {
                return <Panel style={{ minHeight: 420 }} />;
              }
              return (
                <QuizCard
                  quiz={q}
                  selected={quizSelected}
                  onSelect={() => {}}
                  hideOptions
                  hidePrompt
                >
                  {phase === "meaning" && items[current] && (
                    <div>
                      {(() => {
                        const it = items[current];
                        if (!it) return null;
                        const hasKanji = it.kanji && it.kanji !== it.kana;
                        return (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 14,
                            }}
                          >
                            <KanaRow>
                              <Kana>{it.kana}</Kana>
                              {hasKanji && <Kanji>{it.kanji}</Kanji>}
                            </KanaRow>
                            <div
                              style={{
                                textAlign: "center",
                                fontSize: "1.25rem",
                                fontWeight: 700,
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {it.meanings?.ko}
                            </div>
                            {it.examples && it.examples.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 12,
                                }}
                              >
                                {it.examples.map((ex, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      color: "#334155",
                                      textAlign: "center",
                                      padding: 16,
                                      background: "#f8fafc",
                                      borderRadius: 12,
                                      border: `1px solid ${colors.border}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: "1.125rem",
                                        marginBottom: 4,
                                      }}
                                    >
                                      {ex.sentence}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.9375rem",
                                        color: "#64748b",
                                        marginBottom: 2,
                                      }}
                                    >
                                      {ex.pronunciation}
                                    </div>
                                    <div style={{ fontSize: "1rem" }}>
                                      {ex.translation?.ko}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                marginTop: 12,
                              }}
                            >
                              <button
                                onClick={() => {
                                  setFeedback(null);
                                  advanceAfter(0);
                                }}
                                style={{
                                  ...s.button,
                                  ...s.buttonBrand,
                                  fontSize: "1rem",
                                  padding: "10px 16px",
                                }}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </QuizCard>
              );
            })()
          ) : translation ? (
            <Panel
              style={{
                minHeight: 420,
                display: "flex",
                gap: 16,
                position: "relative",
              }}
            >
              {quizSelected === null &&
                typeof timeLeftSec === "number" &&
                typeof timerTotalSec === "number" &&
                timerTotalSec > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 2,
                      pointerEvents: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 999,
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
                        padding: "6px 10px 8px 10px",
                        minWidth: 96,
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{ position: "relative", width: 28, height: 28 }}
                      >
                        <svg
                          width={28}
                          height={28}
                          viewBox="0 0 28 28"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            transform: "rotate(-90deg)",
                          }}
                          aria-hidden="true"
                        >
                          <circle
                            cx={14}
                            cy={14}
                            r={11}
                            stroke="#e2e8f0"
                            strokeWidth={3}
                            fill="none"
                          />
                          <circle
                            cx={14}
                            cy={14}
                            r={11}
                            stroke="#f97316"
                            strokeWidth={3}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 11}
                            strokeDashoffset={
                              2 *
                              Math.PI *
                              11 *
                              (1 -
                                Math.max(
                                  0,
                                  Math.min(1, timeLeftSec / timerTotalSec)
                                ))
                            }
                          />
                        </svg>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#f97316",
                          }}
                        >
                          <svg
                            width={16}
                            height={16}
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {Math.max(0, Math.ceil(timeLeftSec))}s
                      </div>
                    </div>
                  </div>
                )}
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: "1.25rem",
                  letterSpacing: "-0.01em",
                  marginTop:
                    quizSelected === null &&
                    typeof timeLeftSec === "number" &&
                    typeof timerTotalSec === "number" &&
                    timerTotalSec > 0
                      ? 64
                      : 0,
                }}
              >
                Translate: {translation.promptKo}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "1.375rem",
                  }}
                >
                  {translation.maskedSentence}
                </div>
                <input
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const answer = typedAnswer.trim();
                      if (answer.length === 0) return;
                      const isCorrect = answer === translation.blankLabel;
                      setQuizSelected(isCorrect ? 0 : (-1 as any));
                      setPhase("emoji");
                      setFeedback({
                        key: `${Date.now()}`,
                        code: isCorrect
                          ? emojiCode("success")
                          : emojiCode("fail"),
                        until: Date.now() + 1000,
                      });
                      const item = items[current];
                      (async () => {
                        if (!user || !item?.id) return;
                        try {
                          await incrementReviewStats(user.uid);
                        } catch (_) {}
                        try {
                          await recordReviewEvent(
                            user.uid,
                            deckRef.current,
                            item.id,
                            isCorrect ? ("good" as Rating) : ("again" as Rating)
                          );
                          await updateUserLastReview(
                            user.uid,
                            deckRef.current,
                            item.id,
                            isCorrect ? ("good" as Rating) : ("again" as Rating)
                          );
                          await incrementDeckReviewStats(
                            user.uid,
                            deckRef.current
                          );
                        } catch (_) {}
                        try {
                          await updateLeitnerOnQuiz(
                            user.uid,
                            deckRef.current,
                            item.id,
                            isCorrect
                          );
                        } catch (_) {}
                      })();
                      window.setTimeout(() => {
                        setFeedback(null);
                        setPhase("meaning");
                      }, 1000);
                    }
                  }}
                  placeholder="Type the missing word"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: "#fff7ed",
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    minWidth: 200,
                    textAlign: "center",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => {
                    if (quizSelected !== null || isAdvancing) return;
                    const answer = typedAnswer.trim();
                    if (answer.length === 0) return;
                    const isCorrect = answer === translation.blankLabel;
                    setQuizSelected(isCorrect ? 0 : (-1 as any));
                    setPhase("emoji");
                    setFeedback({
                      key: `${Date.now()}`,
                      code: isCorrect
                        ? emojiCode("success")
                        : emojiCode("fail"),
                      until: Date.now() + 1000,
                    });
                    const item = items[current];
                    (async () => {
                      if (!user || !item?.id) return;
                      try {
                        await incrementReviewStats(user.uid);
                      } catch (_) {}
                      try {
                        await recordReviewEvent(
                          user.uid,
                          deckRef.current,
                          item.id,
                          isCorrect ? ("good" as Rating) : ("again" as Rating)
                        );
                        await updateUserLastReview(
                          user.uid,
                          deckRef.current,
                          item.id,
                          isCorrect ? ("good" as Rating) : ("again" as Rating)
                        );
                        await incrementDeckReviewStats(
                          user.uid,
                          deckRef.current
                        );
                      } catch (_) {}
                      try {
                        await updateLeitnerOnQuiz(
                          user.uid,
                          deckRef.current,
                          item.id,
                          isCorrect
                        );
                      } catch (_) {}
                    })();
                    window.setTimeout(() => {
                      setFeedback(null);
                      setPhase("meaning");
                    }, 1000);
                  }}
                  style={{ ...s.button, ...s.buttonBrand }}
                >
                  Check
                </button>
              </div>
            </Panel>
          ) : quiz ? (
            <QuizCard
              quiz={quiz!}
              selected={quizSelected}
              timeLeftSec={
                typeof timeLeftSec === "number" ? timeLeftSec : undefined
              }
              timerTotalSec={timerTotalSec}
              onSelect={(i) => {
                if (quizSelected !== null) return;
                if (isAdvancing) return;
                setQuizEndsAt(null);
                setQuizSelected(i);
                setPhase("emoji");
                const isCorrect = i >= 0 ? quiz.options[i]?.isCorrect : false;
                const cp = isCorrect ? emojiCode("success") : emojiCode("fail");
                setFeedback({
                  key: `${Date.now()}`,
                  code: cp,
                  until: Date.now() + 1000,
                });
                const item = items[current];
                (async () => {
                  if (!user || !item?.id) return;
                  try {
                    await incrementReviewStats(user.uid);
                  } catch (_) {}
                  try {
                    await recordReviewEvent(
                      user.uid,
                      deckRef.current,
                      item.id,
                      isCorrect ? ("good" as Rating) : ("again" as Rating)
                    );
                    await updateUserLastReview(
                      user.uid,
                      deckRef.current,
                      item.id,
                      isCorrect ? ("good" as Rating) : ("again" as Rating)
                    );
                    await incrementDeckReviewStats(user.uid, deckRef.current);
                  } catch (_) {}
                  try {
                    await updateLeitnerOnQuiz(
                      user.uid,
                      deckRef.current,
                      item.id,
                      !!isCorrect
                    );
                  } catch (_) {}
                  try {
                    // optimistic local update of box chips
                    try {
                      const map = leitnerMapRef.current || new Map();
                      const prev = (map.get(item.id) as any)?.box ?? 1;
                      const delta = isCorrect ? 1 : -1;
                      const next: 1 | 2 | 3 = Math.max(
                        1,
                        Math.min(3, (Number(prev) || 1) + delta)
                      ) as 1 | 2 | 3;
                      map.set(item.id, { box: next } as any);
                      leitnerMapRef.current = map as any;
                      const ids1: string[] = [];
                      const ids2: string[] = [];
                      const ids3: string[] = [];
                      (map as any as Map<string, { box: 1 | 2 | 3 }>).forEach(
                        (v, k) => {
                          if (v.box === 1) ids1.push(k);
                          else if (v.box === 2) ids2.push(k);
                          else ids3.push(k);
                        }
                      );
                      const nameOf = async (vid: string): Promise<string> => {
                        try {
                          const ref = doc(db, deckRef.current, vid);
                          const snap = await getDoc(ref);
                          if (snap.exists()) {
                            const d = snap.data() as any;
                            const word = `${d.kana}${
                              d.kanji && d.kanji !== d.kana
                                ? ` (${d.kanji})`
                                : ""
                            }`;
                            return word;
                          }
                        } catch (_) {}
                        return vid;
                      };
                      const [w1, w2, w3] = await Promise.all([
                        Promise.all(ids1.slice(0, 30).map(nameOf)),
                        Promise.all(ids2.slice(0, 30).map(nameOf)),
                        Promise.all(ids3.slice(0, 30).map(nameOf)),
                      ]);
                      setBox1Words(w1);
                      setBox2Words(w2);
                      setBox3Words(w3);
                    } catch (_) {}
                  } catch (_) {}
                  try {
                    await refreshLeitnerBoxes();
                  } catch (_) {}
                })();
                window.setTimeout(() => {
                  setFeedback(null);
                  setPhase("meaning");
                }, 1000);
              }}
            />
          ) : null}
        </CardWrap>
        <aside style={{ minHeight: 420, display: "flex", width: "100%" }}>
          <StatsPanel
            dailyGoal={dailyGoal}
            daily={daily}
            stats={stats as any}
            deckTotal={deckTotal}
            itemsLoaded={items.length}
            boxCounts={boxCounts}
            onChangeDailyGoal={async (goal: number) => {
              try {
                if (!user) return;
                await setDeckDailyGoal(user.uid, deckRef.current, goal);
                setDailyGoal(goal);
              } catch (_) {}
            }}
          />
        </aside>
      </PageGrid>
    </div>
  );
}
