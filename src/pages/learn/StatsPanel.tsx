import { Panel } from "./Styles";
import { StatGrid } from "./StatGrid";
import { useI18n } from "../../i18n/I18nContext";

// MiniStat moved to StatGrid

export function StatsPanel({
  dailyGoal,
  daily,
  stats,
  memorizedCount,
  deckTotal,
  itemsLoaded,
}: {
  dailyGoal: number;
  daily: { reviewsToday: number; streakDays: number };
  stats: {
    dueNow: number;
    overdue: number;
    todayAccuracy: number;
    todayMix: { again: number; hard: number; good: number; easy: number };
    retention7d: number;
    medianStability: number;
    difficultyMix: { low: number; mid: number; high: number };
    forecast7d: number[];
  };
  memorizedCount: number;
  deckTotal: number;
  itemsLoaded: number;
}) {
  const { t } = useI18n();
  return (
    <Panel>
      <div style={{ fontWeight: 700, letterSpacing: "-0.01em", fontSize: 20 }}>
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
      <StatGrid
        columns={5}
        items={[
          { label: t("stats.again"), value: stats.todayMix.again },
          { label: t("stats.hard"), value: stats.todayMix.hard },
          { label: t("stats.good"), value: stats.todayMix.good },
          { label: t("stats.easy"), value: stats.todayMix.easy },
          {
            label: t("stats.acc"),
            value: `${Math.round(stats.todayAccuracy * 100)}%`,
          },
        ]}
      />
      <StatGrid
        columns={3}
        items={[
          {
            label: t("stats.ret7"),
            value: `${Math.round(stats.retention7d * 100)}%`,
          },
          { label: t("stats.medS"), value: stats.medianStability.toFixed(2) },
          { label: t("stats.mem"), value: `${memorizedCount}/${deckTotal}` },
        ]}
      />
      <StatGrid
        columns={3}
        items={[
          { label: "D≤4", value: stats.difficultyMix.low },
          { label: "D4-7", value: stats.difficultyMix.mid },
          { label: "D≥7", value: stats.difficultyMix.high },
        ]}
      />
      {stats.forecast7d.length > 0 && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>
            {t("stats.next7")}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "flex-end",
              height: 60,
            }}
          >
            {stats.forecast7d.map((v, i) => {
              const h = Math.max(4, Math.min(60, v * 3));
              return (
                <div key={i} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 10,
                      height: h,
                      background: "#e2e8f0",
                      borderRadius: 3,
                    }}
                  />
                  <div style={{ fontSize: 10, marginTop: 4 }}>{v}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
