import { Link, useLocation } from "react-router-dom";
import { s, colSpan } from "../ui/layout";

export function DecksPage() {
  const location = useLocation();
  // Static list for now; can be extended to query a 'decks' collection later
  const decks = [
    {
      id: "japanese",
      title: "Japanese",
      description: "Counters, particles, and core vocabulary from Firestore",
      sizeHint: "900+ items",
    },
  ];

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
          <h2 style={{ margin: 0 }}>Choose a deck</h2>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {decks.length} deck{decks.length === 1 ? "" : "s"} available
          </div>
        </div>
        <div style={s.grid12}>
          {decks.map((d) => (
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
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {d.sizeHint}
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
