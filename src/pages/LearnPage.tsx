import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  incrementReviewStats,
  setUserCurrentDeck,
  updateSrsOnAnswer,
  recordReviewEvent,
  updateUserLastReview,
  incrementDeckReviewStats,
  type Rating,
} from "../services/userService";
import { useLocation, useNavigate } from "react-router-dom";
import { s } from "../ui/layout";
import { AnimatedEmoji, emojiCode } from "../ui/AnimatedEmoji";
import { CardWrap, Panel } from "./learn/Styles";
import { StatsPanel } from "./learn/StatsPanel";
import { QuizCard } from "./learn/QuizCard";
import { ReviewCard } from "./learn/ReviewCard";
import { getDeckMetadata } from "../services/deckService";
import {
  getTodayRatingDistribution,
  get7DayRetention,
} from "../services/reviewStatsService";
import {
  getDueVocabIdsForDeck,
  countOverdueForDeck,
  medianStabilityOfDue,
  difficultyBucketsOfDue,
  forecastCountsNext7Days,
  getUpcomingVocabIdsForDeck,
  updateFsrsOnAnswer,
} from "../services/fsrsService";
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

// Session-level relearning configuration to approximate Anki defaults:
// Learning steps: 1m, 10m for "Again"; shorter delay for "Hard".
const LEARN_STEPS_MS = [60_000, 10 * 60_000];
const HARD_DELAY_MS = 90_000;

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
  const [showAnswer, setShowAnswer] = useState(false);
  const [daily, setDaily] = useState<{
    reviewsToday: number;
    streakDays: number;
  }>({ reviewsToday: 0, streakDays: 0 });
  const [deckTotal, setDeckTotal] = useState<number>(0);
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [memorizedCount, setMemorizedCount] = useState<number>(0);
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
  const surpriseEveryN = 5;
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
  const learningMapRef = useRef<
    Map<string, { item: JapaneseDoc; availableAt: number }>
  >(new Map());
  const stepMapRef = useRef<Map<string, number>>(new Map());

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

  function scheduleRelearn(item: JapaneseDoc, kind: "again" | "hard") {
    if (!item || !item.id) return;
    const now = Date.now();
    if (kind === "again") {
      // Reset to first learning step on Again
      const stepIdx = 0;
      const delay = LEARN_STEPS_MS[stepIdx];
      learningMapRef.current.set(item.id, {
        item,
        availableAt: now + delay,
      });
      stepMapRef.current.set(item.id, stepIdx);
    } else if (kind === "hard") {
      learningMapRef.current.set(item.id, {
        item,
        availableAt: now + HARD_DELAY_MS,
      });
    }
  }

  function scheduleNextLearningStep(item: JapaneseDoc) {
    if (!item || !item.id) return;
    const now = Date.now();
    const prev = stepMapRef.current.get(item.id) ?? 0;
    const next = prev + 1;
    if (next < LEARN_STEPS_MS.length) {
      stepMapRef.current.set(item.id, next);
      learningMapRef.current.set(item.id, {
        item,
        availableAt: now + LEARN_STEPS_MS[next],
      });
    } else {
      // Graduated from learning steps
      stepMapRef.current.delete(item.id);
      learningMapRef.current.delete(item.id);
    }
  }

  function insertDueLearningItems() {
    const now = Date.now();
    const due: Array<{ id: string; item: JapaneseDoc }> = [];
    learningMapRef.current.forEach((entry, id) => {
      if (entry.availableAt <= now) due.push({ id, item: entry.item });
    });
    if (due.length === 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const insertAt = Math.min(currentRef.current + 1, copy.length);
      for (const d of due) {
        // If the card exists ahead in the queue, move it forward near insertAt
        const existingIdx = copy.findIndex(
          (x, idx) => idx >= insertAt && (x as any).id === d.item.id
        );
        if (existingIdx !== -1) {
          const [moved] = copy.splice(existingIdx, 1);
          copy.splice(insertAt, 0, moved as any);
        } else {
          copy.splice(insertAt, 0, d.item as any);
        }
        learningMapRef.current.delete(d.id);
      }
      return copy;
    });
  }

  function advanceAfter(ms: number) {
    setIsAdvancing(true);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      setCurrent((n) => {
        const next = (n + 1) % Math.max(1, items.length);
        const index1Based = n + 1;
        if (index1Based % surpriseEveryN === 0 && surprisePool.length > 5) {
          const rnd = Math.floor(Math.random() * surprisePool.length);
          const target = surprisePool[rnd];
          const q = buildMcqFor(target, surprisePool);
          if (q) setQuiz(q);
        }
        return next;
      });
      insertDueLearningItems();
      // Clear any active quiz state when moving on
      setQuiz(null);
      setQuizSelected(null);
      setFeedback(null);
      setIsAdvancing(false);
    }, Math.max(0, ms));
  }
  async function refreshStats(currentUid: string, currentDeck: string) {
    try {
      const [mix, retention, overdue, forecast, medianS, diffMix, dueIds] =
        await Promise.all([
          getTodayRatingDistribution(currentUid, currentDeck),
          get7DayRetention(currentUid, currentDeck),
          countOverdueForDeck(currentUid, currentDeck),
          forecastCountsNext7Days(currentUid, currentDeck),
          medianStabilityOfDue(currentUid, currentDeck),
          difficultyBucketsOfDue(currentUid, currentDeck),
          getDueVocabIdsForDeck(currentUid, currentDeck, 50),
        ]);
      const totalToday = mix.again + mix.hard + mix.good + mix.easy;
      const todayAccuracy =
        totalToday > 0 ? (mix.hard + mix.good + mix.easy) / totalToday : 0;
      setStats((prev) => ({
        ...prev,
        dueNow: dueIds.length,
        overdue,
        todayMix: mix,
        todayAccuracy,
        retention7d: retention,
        forecast7d: forecast,
        medianStability: medianS,
        difficultyMix: diffMix,
      }));
    } catch (_) {}
  }
  const [isNarrow, setIsNarrow] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 900 : true
  );
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const deck = params.get("deck") || "japanese";

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  const [deckTitle, setDeckTitle] = useState<string>("");
  const headline = useMemo(() => {
    if (isLoading) return "Loading";
    const base = user ? "Your queue" : "Public queue";
    return deckTitle ? `${deckTitle}` : `${base}`;
  }, [isLoading, user, deckTitle]);

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
          try {
            const mem = await getMemorizedSetForDeck(user.uid, deck);
            setMemorizedCount(mem.size);
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

          // Try FSRS queue first: show due items first; if none, show upcoming soonest
          try {
            const dueIds = await getDueVocabIdsForDeck(user.uid, deck, 100);
            setStats((prev) => ({ ...prev, dueNow: dueIds.length }));
            const idsToFetch =
              dueIds.length > 0
                ? dueIds
                : await getUpcomingVocabIdsForDeck(user.uid, deck, 100);
            if (idsToFetch.length > 0) {
              const docs: JapaneseDoc[] = [];
              for (const id of idsToFetch.slice(0, 50)) {
                const ref = doc(db, deck, id);
                const snap = await getDoc(ref);
                if (snap.exists()) docs.push({ id, ...(snap.data() as any) });
              }
              if (docs.length > 0) {
                setItems(docs);
                // Build surprise quiz pool from user's recent Easy/Good selections
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
          } catch (_) {
            // ignore FSRS errors and fall back to default loading
          }
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

  // Reset card state when current changes
  useEffect(() => {
    setShowAnswer(false);
  }, [current]);

  // Reveal answer on Space key (disabled during advancing)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.key === " ") {
        if (!showAnswer && !isAdvancing && !quiz) {
          e.preventDefault();
          setShowAnswer(true);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAnswer, isAdvancing, quiz]);

  const onRate = async (rating: Rating) => {
    if (isAdvancing) return;
    if (!user) return;
    const currentItem = items[current];

    // Immediate UI updates
    setDaily((d) => ({ ...d, reviewsToday: d.reviewsToday + 1 }));
    setStats((prev) => {
      const mix = { ...prev.todayMix } as any;
      mix[rating] = (mix[rating] || 0) + 1;
      const total = mix.again + mix.hard + mix.good + mix.easy;
      const acc = total > 0 ? (mix.hard + mix.good + mix.easy) / total : 0;
      const dueNow = Math.max(0, prev.dueNow - 1);
      return { ...prev, todayMix: mix, todayAccuracy: acc, dueNow };
    });
    const cp =
      rating === "again"
        ? emojiCode("again")
        : rating === "hard"
        ? emojiCode("hard")
        : rating === "good"
        ? emojiCode("good")
        : emojiCode("easy");
    setFeedback({ key: `${Date.now()}`, code: cp, until: Date.now() + 1200 });

    // Session-level relearn scheduling (insert near-future slots)
    if (currentItem && currentItem.id) {
      if (rating === "again") {
        scheduleRelearn(currentItem, "again");
      } else if (rating === "hard") {
        scheduleRelearn(currentItem, "hard");
      } else if (rating === "good") {
        // Progress learning step on Good, or clear if finished
        scheduleNextLearningStep(currentItem);
      } else if (rating === "easy") {
        // Graduate from learning immediately
        stepMapRef.current.delete(currentItem.id);
        learningMapRef.current.delete(currentItem.id);
      } else {
        learningMapRef.current.delete(currentItem.id);
      }
    }

    advanceAfter(1200);

    // Maintain surprise pool immediately
    if (currentItem && currentItem.id) {
      if (rating === "good" || rating === "easy") {
        setSurprisePool((pool) => {
          if (pool.find((p) => p.id === currentItem.id)) return pool;
          return [{ ...currentItem }, ...pool].slice(0, 200);
        });
      } else {
        setSurprisePool((pool) => pool.filter((p) => p.id !== currentItem.id));
      }
    }

    // Background operations (non-blocking)
    (async () => {
      try {
        await incrementReviewStats(user.uid);
      } catch (_) {}
      if (currentItem && currentItem.id) {
        try {
          await updateSrsOnAnswer(user.uid, deck, currentItem.id, rating);
        } catch (_) {}
        try {
          await updateFsrsOnAnswer(user.uid, deck, currentItem.id, rating, 0.9);
        } catch (_) {}
        try {
          await recordReviewEvent(user.uid, deck, currentItem.id, rating);
          await updateUserLastReview(user.uid, deck, currentItem.id, rating);
          await incrementDeckReviewStats(user.uid, deck);
        } catch (_) {}
        try {
          // Demote if from surprise pool and failed
          if (rating === "again" || rating === "hard") {
            const wasInPool = surprisePool.find((p) => p.id === currentItem.id);
            if (wasInPool) {
              const demoted: Rating = "hard";
              try {
                await updateSrsOnAnswer(
                  user.uid,
                  deck,
                  currentItem.id,
                  demoted
                );
              } catch (_) {}
              try {
                await updateFsrsOnAnswer(
                  user.uid,
                  deck,
                  currentItem.id,
                  demoted,
                  0.9
                );
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      try {
        await refreshStats(user.uid, deck);
      } catch (_) {}
    })();
  };

  // Keyboard: when quiz open -> 1..4 selects option; otherwise ratings after reveal (disabled during advancing)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (quiz) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          e.preventDefault();
          const idx = Number(e.key) - 1;
          if (idx >= 0 && idx < 4) {
            if (isAdvancing || quizSelected !== null) return;
            setQuizSelected(idx);
            const isCorrect = quiz.options[idx]?.isCorrect;
            const cp = isCorrect ? emojiCode("success") : emojiCode("fail");
            setFeedback({
              key: `${Date.now()}`,
              code: cp,
              until: Date.now() + 1400,
            });
            // optional demotion on wrong answer
            if (!isCorrect && user) {
              const demoted: Rating = "hard";
              updateSrsOnAnswer(user.uid, deck, quiz.cardId, demoted).catch(
                () => {}
              );
              updateFsrsOnAnswer(
                user.uid!,
                deck,
                quiz.cardId,
                demoted,
                0.9
              ).catch(() => {});
            }
            advanceAfter(1400);
          }
        }
        return;
      }
      if (!showAnswer || isAdvancing) return;
      if (e.key === "1") {
        e.preventDefault();
        onRate("again");
      } else if (e.key === "2") {
        e.preventDefault();
        onRate("hard");
      } else if (e.key === "3") {
        e.preventDefault();
        onRate("good");
      } else if (e.key === "4") {
        e.preventDefault();
        onRate("easy");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAnswer, onRate, quiz, isAdvancing, quizSelected, user, deck]);

  return (
    <div style={{ ...s.container }}>
      <h2 style={{ margin: 0, marginBottom: 16, ...s.gradientTitle }}>
        {headline}
      </h2>
      {error && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            background: "#fff7ed",
            color: "#9a3412",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr",
          gap: 16,
          alignItems: "stretch",
          width: "100%",
        }}
      >
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
          ) : quiz ? (
            <QuizCard
              quiz={quiz}
              selected={quizSelected}
              onSelect={(i) => {
                if (quizSelected !== null) return;
                if (isAdvancing) return;
                setQuizSelected(i);
                const isCorrect = quiz.options[i]?.isCorrect;
                const cp = isCorrect ? emojiCode("success") : emojiCode("fail");
                setFeedback({
                  key: `${Date.now()}`,
                  code: cp,
                  until: Date.now() + 1400,
                });
                // hold showing the next state until the emoji is done
                advanceAfter(1400);
              }}
            />
          ) : (
            <ReviewCard
              item={items[current] || ({} as JapaneseDoc)}
              showAnswer={showAnswer}
              onShow={() => setShowAnswer(true)}
              onRate={onRate}
            />
          )}
        </CardWrap>
        <aside style={{ minHeight: 420, display: "flex", width: "100%" }}>
          <StatsPanel
            dailyGoal={dailyGoal}
            daily={daily}
            stats={stats as any}
            memorizedCount={memorizedCount}
            deckTotal={deckTotal}
            itemsLoaded={items.length}
          />
        </aside>
      </div>
    </div>
  );
}
