import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
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

function Card({
  item,
  index,
  showAnswer,
  onShow,
  onRate,
}: {
  item: JapaneseDoc;
  index: number;
  showAnswer: boolean;
  onShow: () => void;
  onRate: (rating: Rating) => void;
}) {
  const hasKanji = item.kanji && item.kanji !== item.kana;
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>#{index + 1}</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{item.kana}</div>
        {hasKanji && (
          <div style={{ fontSize: 20, color: "#64748b" }}>{item.kanji}</div>
        )}
      </div>

      {!showAnswer ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              border: "1px solid #e2e8f0",
              padding: "8px 14px",
              borderRadius: 8,
            }}
            onClick={onShow}
          >
            Show answer
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 16 }}>{item.meanings.ko}</div>
          {item.tags && item.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.map((t, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 999,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {item.examples && item.examples.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {item.examples.map((ex, i) => (
                <div key={i} style={{ color: "#334155" }}>
                  <div style={{ fontWeight: 600 }}>{ex.sentence}</div>
                  <div style={{ fontSize: 14, color: "#64748b" }}>
                    {ex.pronunciation}
                  </div>
                  <div style={{ fontSize: 14 }}>{ex.translation?.ko}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{
                border: "1px solid #e2e8f0",
                padding: "8px 14px",
                borderRadius: 8,
              }}
              onClick={() => onRate("again")}
            >
              Again
            </button>
            <button
              style={{
                border: "1px solid #e2e8f0",
                padding: "8px 14px",
                borderRadius: 8,
              }}
              onClick={() => onRate("hard")}
            >
              Hard
            </button>
            <button
              style={{
                border: "1px solid #e2e8f0",
                padding: "8px 14px",
                borderRadius: 8,
                background: "#f97316",
                color: "#fff",
              }}
              onClick={() => onRate("good")}
            >
              Good
            </button>
            <button
              style={{
                border: "1px solid #e2e8f0",
                padding: "8px 14px",
                borderRadius: 8,
              }}
              onClick={() => onRate("easy")}
            >
              Easy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LearnPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<JapaneseDoc[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const deck = params.get("deck") || "japanese";

  const headline = useMemo(() => {
    if (isLoading) return "Loading";
    return user ? "Your queue" : "Public queue";
  }, [isLoading, user]);

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
        }
        const q = query(collection(db, deck), orderBy("kana"), limit(50));
        const snap = await getDocs(q);
        const list: JapaneseDoc[] = [];
        snap.forEach((doc) =>
          list.push({ id: doc.id, ...(doc.data() as any) })
        );
        setItems(list);
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

  const onRate = async (rating: Rating) => {
    try {
      if (user) {
        await incrementReviewStats(user.uid);
        const currentItem = items[current];
        if (currentItem && currentItem.id) {
          await updateSrsOnAnswer(user.uid, deck, currentItem.id, rating);
          // Persist a review event and last review pointer
          const { recordReviewEvent, updateUserLastReview } = await import(
            "../services/userService"
          );
          await recordReviewEvent(user.uid, deck, currentItem.id, rating);
          await updateUserLastReview(user.uid, deck, currentItem.id, rating);
        }
      }
    } finally {
      // Always progress to next card to keep UX snappy
      setCurrent((n) => (n + 1) % Math.max(1, items.length));
    }
  };

  return (
    <div style={{ ...s.container }}>
      <div style={{ ...s.stack }}>
        <h2>
          {headline} · Deck: {deck}
        </h2>
        {error ? (
          <div style={s.card}>{error}</div>
        ) : items.length === 0 ? (
          <div style={s.card}>No items yet.</div>
        ) : (
          <Card
            item={items[current]}
            index={current}
            showAnswer={showAnswer}
            onShow={() => setShowAnswer(true)}
            onRate={onRate}
          />
        )}
      </div>
    </div>
  );
}
