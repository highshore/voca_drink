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
  box1,
  box2,
  box3,
}: {
  dailyGoal: number;
  daily: { reviewsToday: number; streakDays: number };
  stats: {
    dueNow: number;
    overdue: number;
  };
  deckTotal: number;
  itemsLoaded: number;
  box1: string[];
  box2: string[];
  box3: string[];
}) {
  const { t } = useI18n();
  function BoxRow({ label, words }: { label: string; words: string[] }) {
    return (
      <div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>
          {label} ({words.length})
        </div>
        {words.length === 0 ? (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>—</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {words.map((w) => (
              <span
                key={w}
                style={{
                  fontSize: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  padding: "4px 8px",
                  background: "#f8fafc",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={w}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <BoxRow label="Box 1" words={box1} />
          <BoxRow label="Box 2" words={box2} />
          <BoxRow label="Box 3" words={box3} />
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
