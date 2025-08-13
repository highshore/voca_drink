import { Panel } from "./Styles";
import { StatGrid } from "./StatGrid";

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
  return (
    <Panel>
      <div style={{ fontWeight: 700, letterSpacing: "-0.01em", fontSize: 20 }}>
        Progress
      </div>
      <StatGrid
        columns={2}
        items={[
          { label: "Due", value: stats.dueNow },
          { label: "Overdue", value: stats.overdue },
          {
            label: "Remain",
            value: Math.max(0, dailyGoal - daily.reviewsToday),
          },
          { label: "Done", value: daily.reviewsToday },
        ]}
      />
      <StatGrid
        columns={5}
        items={[
          { label: "Again", value: stats.todayMix.again },
          { label: "Hard", value: stats.todayMix.hard },
          { label: "Good", value: stats.todayMix.good },
          { label: "Easy", value: stats.todayMix.easy },
          { label: "Acc", value: `${Math.round(stats.todayAccuracy * 100)}%` },
        ]}
      />
      <StatGrid
        columns={3}
        items={[
          { label: "7d Ret", value: `${Math.round(stats.retention7d * 100)}%` },
          { label: "Med S", value: stats.medianStability.toFixed(2) },
          { label: "Mem", value: `${memorizedCount}/${deckTotal}` },
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
            Next 7 days load
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
          { label: "Streak", value: `${daily.streakDays}d` },
          { label: "Words", value: deckTotal },
          { label: "Loaded", value: itemsLoaded },
        ]}
      />
    </Panel>
  );
}
