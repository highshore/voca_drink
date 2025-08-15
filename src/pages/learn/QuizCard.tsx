import { Panel } from "./Styles";

export type QuizOption = { text: string; isCorrect: boolean };
export type McqQuiz =
  | { type: "mcq"; cardId: string; prompt: string; options: QuizOption[] }
  | { type: "rev"; cardId: string; prompt: string; options: QuizOption[] };

export function QuizCard({
  quiz,
  selected,
  onSelect,
}: {
  quiz: McqQuiz;
  selected: number | null;
  onSelect: (idx: number) => void;
}) {
  return (
    <Panel style={{ justifyContent: "center", padding: 28 }}>
      <div style={{ fontWeight: 800, fontSize: 22, textAlign: "center" }}>
        {quiz.prompt}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => (selected === null ? onSelect(i) : undefined)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "14px 18px",
              fontSize: 18,
              fontWeight: 700,
              background:
                selected === null
                  ? "#f8fafc"
                  : i === selected
                  ? opt.isCorrect
                    ? "#dcfce7"
                    : "#fee2e2"
                  : "#ffffff",
              cursor: selected === null ? "pointer" : "default",
              willChange: "transform",
              transform: selected === i ? "scale(0.98)" : undefined,
              transition: "transform 120ms ease",
            }}
          >
            {i + 1}) {opt.text}
          </button>
        ))}
      </div>
    </Panel>
  );
}
