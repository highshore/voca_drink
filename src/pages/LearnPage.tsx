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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  incrementReviewStats,
  setUserCurrentDeck,
  recordReviewEvent,
  updateUserLastReview,
  incrementDeckReviewStats,
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
  getDueVocabIdsForDeck as getDueLeitner,
  getUpcomingVocabIdsForDeck as getUpcomingLeitner,
  updateLeitnerOnQuiz,
  ensureLeitnerEntries,
  countDueForDeck,
  getBoxIds,
  getLeitnerMapForDeck,
} from "../services/leitnerService";
import { getMemorizedSetForDeck } from "../services/userService";

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
  if (distractors.length < 3) return null;
  const chosen = shuffleArray(distractors).slice(0, 3);
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

export function LearnPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<JapaneseDoc[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // no reveal state in quiz-only flow
  const [showAnswer] = useState(false);
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
  const [phase, setPhase] = useState<"quiz" | "emoji" | "meaning">("quiz");
  const deckRef = useRef<string>("japanese");
  const QUIZ_TIMEOUT_MS = 5000;
  const [quizEndsAt, setQuizEndsAt] = useState<number | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(5);
  const [timerTotalSec, setTimerTotalSec] = useState<number>(5);

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

  // 5s timeout when in quiz phase and no selection
  const quizTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (quizTimeoutRef.current) {
      window.clearTimeout(quizTimeoutRef.current);
      quizTimeoutRef.current = null;
    }
    const item = items[current];
    if (!item || phase !== "quiz" || quizSelected !== null) return;
    // start per-question countdown
    const ends = Date.now() + QUIZ_TIMEOUT_MS;
    setQuizEndsAt(ends);
    setTimerTotalSec(QUIZ_TIMEOUT_MS / 1000);
    setTimeLeftSec(QUIZ_TIMEOUT_MS / 1000);
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

          await refreshStats(user.uid, deckRef.current);
        } catch (_) {}
      })();
      window.setTimeout(() => {
        setFeedback(null);
        setPhase("meaning");
      }, 1000);
    }, 5000) as any;
    return () => {
      if (quizTimeoutRef.current) window.clearTimeout(quizTimeoutRef.current);
      quizTimeoutRef.current = null;
      setQuizEndsAt(null);
    };
  }, [items, current, phase, quizSelected, user]);

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
      if (phase === "meaning" && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        setFeedback(null);
        advanceAfter(0);
      }
      // numeric keys selection while in quiz
      if (phase === "quiz" && quiz && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        if (idx < 0 || idx >= 4) return;
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
            await refreshStats(user.uid, deckRef.current);
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
  }, [phase, quiz, isAdvancing, quizSelected, user, items, current]);

  async function refreshStats(currentUid: string, currentDeck: string) {
    try {
      const [mix, retention, dueCount, b1, b2, b3, lmap] = await Promise.all([
        getTodayRatingDistribution(currentUid, currentDeck),
        get7DayRetention(currentUid, currentDeck),
        countDueForDeck(currentUid, currentDeck),
        getBoxIds(currentUid, currentDeck, 1, 30),
        getBoxIds(currentUid, currentDeck, 2, 30),
        getBoxIds(currentUid, currentDeck, 3, 30),
        getLeitnerMapForDeck(currentUid, currentDeck),
      ]);
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
      // Load readable words for boxes
      const nameOf = async (vid: string): Promise<string> => {
        try {
          const ref = doc(db, currentDeck, vid);
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
        Promise.all(b1.map(nameOf)),
        Promise.all(b2.map(nameOf)),
        Promise.all(b3.map(nameOf)),
      ]);
      setBox1Words(w1);
      setBox2Words(w2);
      setBox3Words(w3);
      const m = new Map<string, { box: 1 | 2 | 3 }>();
      (lmap as any as Map<string, any>).forEach((entry: any, vid: string) => {
        m.set(vid, { box: (entry.box as 1 | 2 | 3) ?? 1 });
      });
      leitnerMapRef.current = m as any;
    } catch (_) {}
  }
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
  const [box1Words, setBox1Words] = useState<string[]>([]);
  const [box2Words, setBox2Words] = useState<string[]>([]);
  const [box3Words, setBox3Words] = useState<string[]>([]);
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
    const unsub = onSnapshot(qref, async (snap) => {
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
        // Update due count
        setStats((prev) => ({ ...prev, dueNow: dueCount }));
        // Update map ref
        leitnerMapRef.current = m as any;
        // Load readable words
        const nameOf = async (vid: string): Promise<string> => {
          try {
            const ref = doc(db, deck, vid);
            const snapDoc = await getDoc(ref);
            if (snapDoc.exists()) {
              const d = snapDoc.data() as any;
              return `${d.kana}${
                d.kanji && d.kanji !== d.kana ? ` (${d.kanji})` : ""
              }`;
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
    });
    return () => unsub();
  }, [user, deck]);
  useEffect(() => {
    async function load() {
      if (deck !== "japanese") {
        navigate("/decks", { replace: true });
        return;
      }
      try {
        setError(null);
        if (user) {
          await setUserCurrentDeck(user.uid, deck);
          // Load user daily stats
          const uref = doc(db, "users", user.uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const d = usnap.data() as any;
            setDaily({
              reviewsToday: Number(d.reviewsToday || 0),
              streakDays: Number(d.streakDays || 0),
            });
            setDailyGoal(Number(d.dailyGoal || 20));
          }
          // Coverage (memorized)
          // memorized no longer used in panel
          try {
            await getMemorizedSetForDeck(user.uid, deck);
          } catch (_) {}
          await refreshStats(user.uid, deck);

          // Metadata (name/title/count)
          try {
            const meta = await getDeckMetadata(deck);
            if (meta) {
              setDeckTitle(meta.name || meta.title || deck);
              setDeckTotal(meta.count);
            }
          } catch (_) {}

          // Leitner: ensure entries then load due or upcoming next
          try {
            // seed Leitner entries for the first 100 lexemes if needed
            const seedQuery = query(
              collection(db, deck),
              orderBy("kana"),
              limit(100)
            );
            const seedSnap = await getDocs(seedQuery);
            const seedIds: string[] = [];
            seedSnap.forEach((d) => {
              if (
                d.id === "metadata" ||
                d.id === "meta" ||
                d.id === "_meta" ||
                d.id === "__meta__"
              )
                return;
              seedIds.push(d.id);
            });
            await ensureLeitnerEntries(user.uid, deck, seedIds);

            const dueIds = await getDueLeitner(user.uid, deck, 100);
            setStats((prev) => ({ ...prev, dueNow: dueIds.length }));
            const idsToFetch =
              dueIds.length > 0
                ? dueIds
                : await getUpcomingLeitner(user.uid, deck, 100);
            if (idsToFetch.length > 0) {
              const docs: JapaneseDoc[] = [];
              for (const id of idsToFetch.slice(0, 50)) {
                const ref = doc(db, deck, id);
                const snap = await getDoc(ref);
                if (snap.exists()) docs.push({ id, ...(snap.data() as any) });
              }
              if (docs.length > 0) {
                setItems(docs);
                // Build surprise pool as before (based on recent corrects)
                try {
                  const { collection, orderBy, limit, query, getDocs } =
                    await import("firebase/firestore");
                  const rcol = collection(db, "users", user.uid, "reviews");
                  const rsnap = await getDocs(
                    query(rcol, orderBy("createdAt", "desc"), limit(500))
                  );
                  const ids = new Set<string>();
                  rsnap.forEach((d) => {
                    const data = d.data() as any;
                    if (data.deck !== deck) return;
                    if (data.rating === "good" || data.rating === "easy") {
                      if (typeof data.vocabId === "string")
                        ids.add(data.vocabId);
                    }
                  });
                  const pool: JapaneseDoc[] = [];
                  for (const id of ids) {
                    const ref = doc(db, deck, id);
                    const snap = await getDoc(ref);
                    if (snap.exists())
                      pool.push({ id, ...(snap.data() as any) });
                  }
                  setSurprisePool(pool);
                } catch (_) {}
                return;
              }
            }
          } catch (_) {}
        }
        const q = query(collection(db, deck), orderBy("kana"), limit(50));
        const snap = await getDocs(q);
        const list: JapaneseDoc[] = [];
        snap.forEach((d) => {
          if (
            d.id === "metadata" ||
            d.id === "meta" ||
            d.id === "_meta" ||
            d.id === "__meta__"
          )
            return;
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setItems(list);
        // Also build surprise pool even when not using FSRS due list
        try {
          if (user) {
            const { collection, orderBy, limit, query, getDocs } = await import(
              "firebase/firestore"
            );
            const rcol = collection(db, "users", user.uid, "reviews");
            const rsnap = await getDocs(
              query(rcol, orderBy("createdAt", "desc"), limit(500))
            );
            const ids = new Set<string>();
            rsnap.forEach((d) => {
              const data = d.data() as any;
              if (data.deck !== deck) return;
              if (data.rating === "good" || data.rating === "easy") {
                if (typeof data.vocabId === "string") ids.add(data.vocabId);
              }
            });
            const pool: JapaneseDoc[] = [];
            for (const id of ids) {
              const ref = doc(db, deck, id);
              const snap = await getDoc(ref);
              if (snap.exists()) pool.push({ id, ...(snap.data() as any) });
            }
            setSurprisePool(pool);
          }
        } catch (_) {}
      } catch (e: any) {
        setError(e?.message || "Failed to load deck.");
        setItems([]);
      }
    }
    load();
  }, [deck, navigate, user]);

  // After items/current load, build a quiz if needed
  useEffect(() => {
    const base = items[current];
    if (!base) return;
    // only regenerate on entering quiz phase or when no quiz exists
    const pool = items.length >= 4 ? items : [...items, ...surprisePool];
    const q = buildMcqFor(base, pool);
    if (q && (phase === "quiz" || !quiz)) {
      setQuiz(q);
      setQuizSelected(null);
    }
  }, [items, current, surprisePool, phase]);

  // no reveal behavior in quiz-only flow

  // With Leitner, we no longer expose self-rated 4-button answers.
  const onRate = async (_rating: Rating) => {
    // disabled path; quizzes will handle promotion/demotion
  };

  // (removed) duplicate keyboard handler to avoid double-processing

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
              const q = buildMcqFor(base, pool);
              if (!q) {
                return (
                  <Panel
                    style={{
                      minHeight: 420,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ color: "#64748b" }}>Preparing quiz…</div>
                  </Panel>
                );
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
                    <div style={{ marginTop: 16 }}>
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
                const isCorrect = quiz.options[i]?.isCorrect;
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

                    await refreshStats(user.uid, deckRef.current);
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
            box1={box1Words}
            box2={box2Words}
            box3={box3Words}
          />
        </aside>
      </PageGrid>
    </div>
  );
}
