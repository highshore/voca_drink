import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  setMemorized,
  unsetMemorized,
  getMemorizedSetForDeck,
} from "../services/userService";
import { s } from "../ui/layout";

type JapaneseDoc = {
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

export function VocabDetailPage() {
  const params = useParams();
  const vocabId = params.id!;
  const location = useLocation();
  const navigate = useNavigate();
  const deck = new URLSearchParams(location.search).get("deck") || "japanese";
  const { user } = useAuth();

  const [item, setItem] = useState<JapaneseDoc | null>(null);
  const [memorized, setMem] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      if (deck !== "japanese") {
        navigate("/decks", { replace: true });
        return;
      }
      const ref = doc(db, deck, vocabId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        navigate("/vocab?deck=" + deck, { replace: true });
        return;
      }
      setItem(snap.data() as JapaneseDoc);

      if (user) {
        const set = await getMemorizedSetForDeck(user.uid, deck);
        setMem(set.has(vocabId));
      }
    }
    load();
  }, [deck, vocabId, navigate, user]);

  async function toggle() {
    if (!user || !item) return;
    if (memorized) {
      await unsetMemorized(user.uid, deck, vocabId);
      setMem(false);
    } else {
      await setMemorized(user.uid, deck, vocabId, item.kana);
      setMem(true);
    }
  }

  if (!item)
    return (
      <div style={{ ...s.container, padding: "24px 0" }}>
        <div style={s.card}>Loading…</div>
      </div>
    );

  return (
    <div style={{ ...s.container, padding: "24px 0" }}>
      <div style={{ ...s.card, display: "flex", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <div style={{ fontWeight: 800, fontSize: 28 }}>{item.kana}</div>
          {item.kanji && item.kanji !== item.kana && (
            <div style={{ color: "#64748b", fontSize: 20 }}>{item.kanji}</div>
          )}
        </div>
        <div>{item.meanings.ko}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.button} onClick={toggle}>
            {memorized ? "Unmark memorized" : "Mark memorized"}
          </button>
        </div>
      </div>
      {item.examples && item.examples.length > 0 && (
        <div style={{ ...s.card, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Examples</div>
          <div style={s.stack}>
            {item.examples.map((ex, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600 }}>{ex.sentence}</div>
                <div style={{ fontSize: 14, color: "#64748b" }}>
                  {ex.pronunciation}
                </div>
                <div style={{ fontSize: 14 }}>{ex.translation?.ko}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
