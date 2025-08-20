import { useEffect, useState } from "react";
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
  const [maxChips, setMaxChips] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const w = window.innerWidth;
    if (w < 480) return 4;
    if (w < 900) return 6;
    return 8;
  });

  useEffect(() => {
    function onResize() {
      const w = window.innerWidth;
      if (w < 480) setMaxChips(4);
      else if (w < 900) setMaxChips(6);
      else setMaxChips(8);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function BoxRow({
    label,
    words,
    max,
  }: {
    label: string;
    words: string[];
    max: number;
  }) {
    const chips = words.slice(0, max);
    const truncated = words.length > max;
    return (
      <div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>
          {label} ({words.length})
        </div>
        {words.length === 0 ? (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>—</span>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {chips.map((w) => (
              <span
                key={w}
                style={{
                  fontSize: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  padding: "4px 8px",
                  background: "#f8fafc",
                }}
              >
                {w}
              </span>
            ))}
            {truncated && (
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>…</span>
            )}
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
          <BoxRow label="Box 1" words={box1} max={maxChips} />
          <BoxRow label="Box 2" words={box2} max={maxChips} />
          <BoxRow label="Box 3" words={box3} max={maxChips} />
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
