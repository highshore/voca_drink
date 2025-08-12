import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  getMemorizedSetForDeck,
  setMemorized,
  unsetMemorized,
} from "../services/userService";
import { s, colSpan } from "../ui/layout";

type JapaneseDoc = {
  id: string;
  kana: string;
  kanji: string;
  meanings: { ko: string };
  examples?: Array<{
    sentence?: string;
    pronunciation?: string;
    translation?: { ko?: string };
  }>;
};

export function VocabListPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const deck = params.get("deck") || "japanese";

  const [items, setItems] = useState<JapaneseDoc[]>([]);
  const [memorized, setMem] = useState<Set<string>>(new Set());

  const title = useMemo(() => `Vocabulary · Deck: ${deck}`, [deck]);

  useEffect(() => {
    async function load() {
      if (deck !== "japanese") {
        navigate("/decks", { replace: true });
        return;
      }
      const q = query(collection(db, deck), orderBy("kana"), limit(200));
      const snap = await getDocs(q);
      const list: JapaneseDoc[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...(doc.data() as any) }));
      setItems(list);

      if (user) {
        const mem = await getMemorizedSetForDeck(user.uid, deck);
        setMem(mem);
      }
    }
    load();
  }, [deck, navigate, user]);

  async function toggleMem(v: JapaneseDoc) {
    if (!user) return;
    const key = v.id;
    if (memorized.has(key)) {
      await unsetMemorized(user.uid, deck, key);
      const copy = new Set(memorized);
      copy.delete(key);
      setMem(copy);
    } else {
      await setMemorized(user.uid, deck, key, v.kana);
      const copy = new Set(memorized);
      copy.add(key);
      setMem(copy);
    }
  }

  return (
    <div style={s.container}>
      <div style={s.stack}>
        <h2>{title}</h2>
        <div style={s.grid12}>
          {items.map((v) => (
            <div key={v.id} style={colSpan(6)}>
              <div style={{ ...s.card, display: "flex", gap: 8 }}>
                <div
                  style={{ display: "flex", gap: 8, alignItems: "baseline" }}
                >
                  <div style={{ fontWeight: 700 }}>{v.kana}</div>
                  {v.kanji && v.kanji !== v.kana && (
                    <div style={{ color: "#64748b" }}>{v.kanji}</div>
                  )}
                </div>
                <div>{v.meanings.ko}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.button} onClick={() => toggleMem(v)}>
                    {memorized.has(v.id) ? "Unmark" : "Mark memorized"}
                  </button>
                  <Link style={s.button} to={`/vocab/${v.id}?deck=${deck}`}>
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
