import { Panel } from "./Styles";
import { StatGrid } from "./StatGrid";
import { useI18n } from "../../i18n/I18nContext";

// MiniStat moved to StatGrid

export function StatsPanel({
  dailyGoal,
  daily,
  stats,
  deckTotal,
  itemsLoaded,
  boxCounts,
}: {
  dailyGoal: number;
  daily: { reviewsToday: number; streakDays: number };
  stats: {
    dueNow: number;
    overdue: number;
  };
  deckTotal: number;
  itemsLoaded: number;
  boxCounts: { box1: number; box2: number; box3: number };
}) {
  const { t } = useI18n();
  const totalInBoxes = boxCounts.box1 + boxCounts.box2 + boxCounts.box3;
  const denom = deckTotal > 0 ? deckTotal : totalInBoxes || 1;
  const pct = (n: number) => Math.round((100 * n) / (denom || 1));
  const complete =
    deckTotal > 0 &&
    boxCounts.box3 >= deckTotal &&
    boxCounts.box1 === 0 &&
    boxCounts.box2 === 0;
  return (
    <Panel>
      <div
        style={{
          fontWeight: 700,
          letterSpacing: "-0.01em",
          fontSize: "1.25rem",
        }}
      >
        {t("stats.progress")}
      </div>
      {complete && (
        <div
          style={{
            padding: 12,
            border: "1px solid #10b981",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: 12,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          🎉 Deck complete! All words are in Easy.
        </div>
      )}
      <StatGrid
        columns={2}
        items={[
          { label: t("stats.due"), value: stats.dueNow },
          { label: t("stats.overdue"), value: stats.overdue },
          {
            label: t("stats.remain"),
            value: Math.max(0, dailyGoal - daily.reviewsToday),
          },
          { label: t("stats.done"), value: daily.reviewsToday },
        ]}
      />
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "#64748b",
            marginBottom: 6,
          }}
        >
          Leitner boxes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Hard", value: boxCounts.box1, color: "#f59e0b" },
            { label: "Good", value: boxCounts.box2, color: "#3b82f6" },
            { label: "Easy", value: boxCounts.box3, color: "#10b981" },
          ].map((row) => (
            <div key={row.label}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  marginBottom: 4,
                }}
              >
                {row.label} ({row.value})
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct(row.value)}%`,
                    height: "100%",
                    background: row.color,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <StatGrid
        columns={3}
        items={[
          { label: t("stats.streak"), value: `${daily.streakDays}d` },
          { label: t("stats.words"), value: deckTotal },
          { label: t("stats.loaded"), value: itemsLoaded },
        ]}
      />
    </Panel>
  );
}
