type StatItem = { label: string; value: string | number };

function MiniStat({ label, value }: StatItem) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 14, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export function StatGrid({
  items,
  columns,
}: {
  items: StatItem[];
  columns: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <MiniStat key={i} label={it.label} value={it.value} />
      ))}
    </div>
  );
}
