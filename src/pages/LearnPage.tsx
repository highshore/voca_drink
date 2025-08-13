import { useEffect, useMemo, useState } from "react";
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
  type Rating,
} from "../services/userService";
import { useLocation, useNavigate } from "react-router-dom";
import { s } from "../ui/layout";
import { CardWrap } from "./learn/Styles";
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

type McqQuiz = {
  type: "mcq";
  cardId: string;
  prompt: string;
  options: Array<{ text: string; isCorrect: boolean }>; // 4 options
};

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
  const options = shuffleArray([
    { text: targetMeaning, isCorrect: true },
    ...chosen.map((d) => ({
      text: (d.meanings?.ko || "").trim(),
      isCorrect: false,
    })),
  ]);
  return {
    type: "mcq",
    cardId: target.id!,
    prompt: `Choose the meaning for: ${target.kana}${
      target.kanji && target.kanji !== target.kana ? ` (${target.kanji})` : ""
    }`,
    options,
  };
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
  const [quizResult, setQuizResult] = useState<"correct" | "wrong" | null>(
    null
  );
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

  // Reveal answer on Space key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.key === " ") {
        if (!showAnswer) {
          e.preventDefault();
          setShowAnswer(true);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAnswer]);

  const onRate = async (rating: Rating) => {
    try {
      if (user) {
        await incrementReviewStats(user.uid);
        // reflect locally
        setDaily((d) => ({ ...d, reviewsToday: d.reviewsToday + 1 }));
        // optimistic update of stats for immediate feedback
        setStats((prev) => {
          const mix = { ...prev.todayMix } as any;
          mix[rating] = (mix[rating] || 0) + 1;
          const total = mix.again + mix.hard + mix.good + mix.easy;
          const acc = total > 0 ? (mix.hard + mix.good + mix.easy) / total : 0;
          const dueNow = Math.max(0, prev.dueNow - 1);
          return { ...prev, todayMix: mix, todayAccuracy: acc, dueNow };
        });
        const currentItem = items[current];
        if (currentItem && currentItem.id) {
          await updateSrsOnAnswer(user.uid, deck, currentItem.id, rating);
          // FSRS scheduling (in parallel to legacy SRS for now)
          try {
            const { updateFsrsOnAnswer } = await import(
              "../services/fsrsService"
            );
            await updateFsrsOnAnswer(
              user.uid,
              deck,
              currentItem.id,
              rating,
              0.9
            );
          } catch (_) {
            // ignore FSRS errors to avoid blocking the session
          }
          const {
            recordReviewEvent,
            updateUserLastReview,
            incrementDeckReviewStats,
          } = await import("../services/userService");
          await recordReviewEvent(user.uid, deck, currentItem.id, rating);
          await updateUserLastReview(user.uid, deck, currentItem.id, rating);
          await incrementDeckReviewStats(user.uid, deck);
          // refresh server-side stats in background
          refreshStats(user.uid, deck);
          // Update surprise pool maintenance (add if good/easy, remove if again/hard)
          if (rating === "good" || rating === "easy") {
            setSurprisePool((pool) => {
              if (pool.find((p) => p.id === currentItem.id)) return pool;
              return [{ ...currentItem }, ...pool].slice(0, 200);
            });
          } else {
            setSurprisePool((pool) =>
              pool.filter((p) => p.id !== currentItem.id)
            );
          }
          // If this was a surprise quiz and the user failed (again/hard), demote the concept by one tier
          // Demotion rule: easy->good, good->hard; again/hard unchanged. We approximate by re-queuing a downgraded rating once.
          // This only applies if the injected item equals currentItem and rating is a failure relative to its pool-qualified state.
          try {
            if (rating === "again" || rating === "hard") {
              // Optionally, we could look up the last rating from reviews to decide demotion. For now, apply demotion if it exists in pool.
              const wasInPool = surprisePool.find(
                (p) => p.id === currentItem.id
              );
              if (wasInPool) {
                // Demote by submitting a synthetic rating one step down relative to best of (good/easy)
                const demoted: Rating = "hard"; // easy->good->hard collapse to hard demotion
                await updateSrsOnAnswer(
                  user.uid,
                  deck,
                  currentItem.id,
                  demoted
                );
                try {
                  const { updateFsrsOnAnswer } = await import(
                    "../services/fsrsService"
                  );
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
      }
    } finally {
      // Inject surprise quiz every N cards if available
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
    }
  };

  // Keyboard: when quiz open -> 1..4 selects option; otherwise ratings after reveal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (quiz) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          e.preventDefault();
          const idx = Number(e.key) - 1;
          if (idx >= 0 && idx < 4) {
            setQuizSelected(idx);
            const isCorrect = quiz.options[idx]?.isCorrect;
            setQuizResult(isCorrect ? "correct" : "wrong");
          }
        }
        return;
      }
      if (!showAnswer) return;
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
  }, [showAnswer, onRate, quiz]);

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
          {quiz ? (
            <QuizCard
              quiz={{
                cardId: quiz.cardId,
                prompt: quiz.prompt,
                options: quiz.options,
              }}
              selected={quizSelected}
              onSelect={(i) => {
                if (quizSelected !== null) return;
                setQuizSelected(i);
                const isCorrect = quiz.options[i]?.isCorrect;
                setQuizResult(isCorrect ? "correct" : "wrong");
              }}
              onContinue={() => {
                if (quizResult === "wrong" && user) {
                  const demoted: Rating = "hard";
                  updateSrsOnAnswer(user.uid, deck, quiz.cardId, demoted).catch(
                    () => {}
                  );
                  import("../services/fsrsService").then(
                    ({ updateFsrsOnAnswer }) =>
                      updateFsrsOnAnswer(
                        user.uid!,
                        deck,
                        quiz.cardId,
                        demoted,
                        0.9
                      ).catch(() => {})
                  );
                }
                setQuiz(null);
                setQuizSelected(null);
                setQuizResult(null);
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
