type StatItem = { label: string; value: string | number };

function MiniStat({ label, value }: StatItem) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 10,
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
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
        gap: 8,
      }}
    >
      {items.map((it, i) => (
        <MiniStat key={i} label={it.label} value={it.value} />
      ))}
    </div>
  );
}
