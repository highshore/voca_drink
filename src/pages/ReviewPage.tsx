import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { setUserCurrentDeck } from "../services/userService";
import { useAuth } from "../auth/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { s } from "../ui/layout";

type JapaneseDoc = {
  kana: string;
  kanji: string;
  meanings: { ko: string };
};

export function ReviewPage() {
  const [items, setItems] = useState<JapaneseDoc[]>([]);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const deck = params.get("deck") || "japanese";

  useEffect(() => {
    async function load() {
      if (deck !== "japanese") {
        navigate("/decks", { replace: true });
        return;
      }
      if (user) {
        await setUserCurrentDeck(user.uid, deck);
      }
      const q = query(collection(db, deck), orderBy("kana"), limit(20));
      const snap = await getDocs(q);
      const list: JapaneseDoc[] = [];
      snap.forEach((doc) => list.push(doc.data() as JapaneseDoc));
      setItems(list);
    }
    load();
  }, [deck, navigate, user]);

  return (
    <div style={s.container}>
      <div style={s.stack}>
        <h2>Quick Review · Deck: {deck}</h2>
        <div style={s.grid12}>
          {items.map((item, idx) => (
            <div key={idx} style={{ gridColumn: "span 4" }}>
              <div
                style={{
                  ...s.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.kana}</div>
                {item.kanji && item.kanji !== item.kana && (
                  <div style={{ color: "#64748b" }}>{item.kanji}</div>
                )}
                <div style={{ fontSize: 14 }}>{item.meanings.ko}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
