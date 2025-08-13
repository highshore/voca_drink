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
import { getDeckMetadata } from "../services/deckService";

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

  const [deckTitle, setDeckTitle] = useState<string>("");
  const [deckCount, setDeckCount] = useState<number | null>(null);
  const title = useMemo(() => {
    const base = `Vocabulary · Deck: ${deck}`;
    return deckTitle ? `${base} · ${deckTitle}` : base;
  }, [deck, deckTitle]);

  useEffect(() => {
    async function load() {
      if (deck !== "japanese") {
        navigate("/decks", { replace: true });
        return;
      }
      try {
        const meta = await getDeckMetadata(deck);
        if (meta) {
          setDeckTitle(meta.name || meta.title || deck);
          setDeckCount(meta.count);
        }
      } catch (_) {}
      const q = query(collection(db, deck), orderBy("kana"), limit(200));
      const snap = await getDocs(q);
      const list: JapaneseDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (
          d.id === "metadata" ||
          d.id === "meta" ||
          d.id === "_meta" ||
          d.id === "__meta__"
        )
          return;
        list.push({ id: d.id, ...(data as any) });
      });
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
        <h2 style={s.gradientTitle}>{title}</h2>
        {deckCount !== null && (
          <div style={{ color: "#64748b" }}>Words: {deckCount}</div>
        )}
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
