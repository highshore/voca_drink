import { Panel } from "./Styles";
import { useI18n } from "../../i18n/I18nContext";

export type QuizOption = { text: string; isCorrect: boolean };
export type McqQuiz = { cardId: string; prompt: string; options: QuizOption[] };

export function QuizCard({
  quiz,
  selected,
  onSelect,
  onContinue,
}: {
  quiz: McqQuiz;
  selected: number | null;
  onSelect: (idx: number) => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  return (
    <Panel style={{ justifyContent: "center", padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 18, textAlign: "center" }}>
        {quiz.prompt}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 8,
        }}
      >
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => (selected === null ? onSelect(i) : undefined)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 16,
              fontWeight: 600,
              background:
                selected === null
                  ? "#f8fafc"
                  : i === selected
                  ? opt.isCorrect
                    ? "#dcfce7"
                    : "#fee2e2"
                  : "#ffffff",
              cursor: selected === null ? "pointer" : "default",
            }}
          >
            {i + 1}) {opt.text}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 10 }}
        >
          <button
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 16px",
              background: "#fff",
              fontWeight: 600,
            }}
            onClick={onContinue}
          >
            {t("quiz.continue")}
          </button>
        </div>
      )}
    </Panel>
  );
}
