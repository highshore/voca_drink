import { Link, useLocation } from "react-router-dom";
import { s, colSpan } from "../ui/layout";
import { useAuth } from "../auth/AuthContext";
import { useEffect, useMemo, useState } from "react";
import {
  addUserDeck,
  getUserDeckIds,
  removeUserDeck,
} from "../services/userService";

export function DecksPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [myDecks, setMyDecks] = useState<string[]>([]);
  const [allDecks] = useState([
    {
      id: "japanese",
      title: "Japanese",
      description: "Counters, particles, and core vocabulary from Firestore",
      sizeHint: "900+ items",
    },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const ids = await getUserDeckIds(user.uid);
        if (!cancelled) setMyDecks(ids);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const otherDecks = useMemo(() => allDecks, [allDecks]);

  return (
    <div style={s.container}>
      <div style={{ ...s.stack, padding: "24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ margin: 0, ...s.gradientTitle }}>Your decks</h2>
          <div style={{ fontSize: 12, color: "#64748b" }}>{myDecks.length}</div>
        </div>
        <div style={s.grid12}>
          {myDecks.length === 0 && (
            <div style={colSpan(12)}>
              <div style={{ ...s.card, color: "#64748b" }}>
                No decks yet. Add from below.
              </div>
            </div>
          )}
          {myDecks.map((id) => {
            const d = allDecks.find((x) => x.id === id);
            if (!d) return null;
            return (
              <div key={d.id} style={colSpan(6)}>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          background: "#f97316",
                          borderRadius: 4,
                        }}
                      />
                      <div
                        style={{ fontWeight: 800, letterSpacing: "-0.01em" }}
                      >
                        {d.title}
                      </div>
                    </div>
                    <button
                      style={s.button}
                      onClick={async () => {
                        if (!user) return;
                        await removeUserDeck(user.uid, d.id);
                        setMyDecks((prev) => prev.filter((x) => x !== d.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ padding: 16, color: "#475569" }}>
                    {d.description}
                  </div>
                  <div
                    style={{
                      padding: 16,
                      borderTop: "1px solid #f1f5f9",
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Link
                      to={`/vocab?deck=${d.id}`}
                      style={s.button}
                      state={{ from: location }}
                    >
                      Browse
                    </Link>
                    <Link
                      to={`/review?deck=${d.id}`}
                      style={s.button}
                      state={{ from: location }}
                    >
                      Review
                    </Link>
                    <Link
                      to={`/learn?deck=${d.id}`}
                      style={{ ...s.button, ...s.buttonBrand }}
                      state={{ from: location }}
                    >
                      Start
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 24,
          }}
        >
          <h2 style={{ margin: 0, ...s.gradientTitle }}>All decks</h2>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {otherDecks.length} available
          </div>
        </div>
        <div style={s.grid12}>
          {otherDecks.map((d) => (
            <div key={d.id} style={colSpan(6)}>
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        background: "#f97316",
                        borderRadius: 4,
                      }}
                    />
                    <div style={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
                      {d.title}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {d.sizeHint}
                    </div>
                    {myDecks.includes(d.id) && (
                      <span
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 12,
                          color: "#0f172a",
                          background: "#f8fafc",
                        }}
                      >
                        Added
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: 16, color: "#475569" }}>
                  {d.description}
                </div>
                <div
                  style={{
                    padding: 16,
                    borderTop: "1px solid #f1f5f9",
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  {user && !myDecks.includes(d.id) && (
                    <button
                      style={s.button}
                      onClick={async () => {
                        if (!user) return;
                        await addUserDeck(user.uid, d.id);
                        setMyDecks((prev) =>
                          prev.includes(d.id) ? prev : [...prev, d.id]
                        );
                      }}
                    >
                      Add
                    </button>
                  )}
                  <Link
                    to={`/vocab?deck=${d.id}`}
                    style={s.button}
                    state={{ from: location }}
                  >
                    Browse
                  </Link>
                  <Link
                    to={`/review?deck=${d.id}`}
                    style={s.button}
                    state={{ from: location }}
                  >
                    Review
                  </Link>
                  <Link
                    to={`/learn?deck=${d.id}`}
                    style={{ ...s.button, ...s.buttonBrand }}
                    state={{ from: location }}
                  >
                    Start
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
