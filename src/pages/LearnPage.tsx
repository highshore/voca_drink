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
import { s, colSpan } from "../ui/layout";

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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div style={{ fontSize: 14, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Card({
  item,
  showAnswer,
  onShow,
  onRate,
}: {
  item: JapaneseDoc;
  showAnswer: boolean;
  onShow: () => void;
  onRate: (rating: Rating) => void;
}) {
  const hasKanji = item.kanji && item.kanji !== item.kana;
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 20,
        background: "#ffffff",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        minHeight: 420,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          justifyContent: "center",
        }}
      >
        <div
          style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          {item.kana}
        </div>
        {hasKanji && (
          <div style={{ fontSize: 30, color: "#64748b", fontWeight: 600 }}>
            {item.kanji}
          </div>
        )}
      </div>

      {/* Reserve answer area to keep card height stable */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {!showAnswer ? (
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
          >
            <button
              style={{
                border: "1px solid #e2e8f0",
                padding: "14px 28px",
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 600,
                background: "#f8fafc",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onClick={onShow}
            >
              Show answer
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 600, textAlign: "center" }}>
              {item.meanings.ko}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {item.tags.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 13,
                      padding: "6px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 999,
                      background: "#f8fafc",
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.examples && item.examples.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  width: "100%",
                }}
              >
                {item.examples.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      color: "#334155",
                      textAlign: "center",
                      padding: "14px",
                      background: "#f8fafc",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}
                    >
                      {ex.sentence}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: "#64748b",
                        marginBottom: 2,
                      }}
                    >
                      {ex.pronunciation}
                    </div>
                    <div style={{ fontSize: 15 }}>{ex.translation?.ko}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          style={{
            border: "none",
            padding: "14px 22px",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            background: "#ef4444",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s",
            minWidth: 120,
          }}
          onClick={() => onRate("again")}
        >
          Struggled
        </button>
        <button
          style={{
            border: "none",
            padding: "14px 22px",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            background: "#f59e0b",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s",
            minWidth: 120,
          }}
          onClick={() => onRate("hard")}
        >
          Maybe
        </button>
        <button
          style={{
            border: "none",
            padding: "14px 22px",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            background: "#10b981",
            color: "#ffffff",
            cursor: "pointer",
            transition: "all 0.2s",
            minWidth: 120,
          }}
          onClick={() => onRate("good")}
        >
          Confident
        </button>
      </div>
    </div>
  );
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
          // Load user daily stats
          const uref = doc(db, "users", user.uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) {
            const d = usnap.data() as any;
            setDaily({
              reviewsToday: Number(d.reviewsToday || 0),
              streakDays: Number(d.streakDays || 0),
            });
          }
        }
        const q = query(collection(db, deck), orderBy("kana"), limit(50));
        const snap = await getDocs(q);
        const list: JapaneseDoc[] = [];
        snap.forEach((doc) =>
          list.push({ id: doc.id, ...(doc.data() as any) })
        );
        setItems(list);
        setDeckTotal(list.length);
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
        // reflect locally
        setDaily((d) => ({ ...d, reviewsToday: d.reviewsToday + 1 }));
        const currentItem = items[current];
        if (currentItem && currentItem.id) {
          await updateSrsOnAnswer(user.uid, deck, currentItem.id, rating);
          const {
            recordReviewEvent,
            updateUserLastReview,
            incrementDeckReviewStats,
          } = await import("../services/userService");
          await recordReviewEvent(user.uid, deck, currentItem.id, rating);
          await updateUserLastReview(user.uid, deck, currentItem.id, rating);
          await incrementDeckReviewStats(user.uid, deck);
        }
      }
    } finally {
      setCurrent((n) => (n + 1) % Math.max(1, items.length));
    }
  };

  return (
    <div style={{ ...s.container }}>
      <h2 style={{ margin: 0, marginBottom: 16 }}>
        {headline} · Deck: {deck}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div style={{ minHeight: 420, display: "flex" }}>
          <Card
            item={items[current] || ({} as JapaneseDoc)}
            showAnswer={showAnswer}
            onShow={() => setShowAnswer(true)}
            onRate={onRate}
          />
        </div>
        <aside style={{ minHeight: 420, display: "flex" }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
              Progress
            </div>
            <StatCard label="Today's reviews" value={daily.reviewsToday} />
            <StatCard label="Streak" value={`${daily.streakDays} days`} />
            <StatCard label="Deck size (loaded)" value={deckTotal} />
          </div>
        </aside>
      </div>
    </div>
  );
}
