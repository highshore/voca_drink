import { Panel, QuizOptionsGrid } from "./Styles";
import type { ReactNode } from "react";

export type QuizOption = { text: string; isCorrect: boolean };
export type McqQuiz =
  | { type: "mcq"; cardId: string; prompt: string; options: QuizOption[] }
  | { type: "rev"; cardId: string; prompt: string; options: QuizOption[] };

export function QuizCard({
  quiz,
  selected,
  onSelect,
  children,
  hideOptions,
  hidePrompt,
  timeLeftSec,
  timerTotalSec,
}: {
  quiz: McqQuiz;
  selected: number | null;
  onSelect: (idx: number) => void;
  children?: ReactNode;
  hideOptions?: boolean;
  hidePrompt?: boolean;
  timeLeftSec?: number;
  timerTotalSec?: number;
}) {
  return (
    <Panel
      style={{ justifyContent: "center", position: "relative", padding: 28 }}
    >
      {selected === null &&
        typeof timeLeftSec === "number" &&
        typeof timerTotalSec === "number" &&
        timerTotalSec > 0 && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
                padding: "6px 10px 8px 10px",
                minWidth: 96,
                justifyContent: "center",
              }}
            >
              <div style={{ position: "relative", width: 28, height: 28 }}>
                <svg
                  width={28}
                  height={28}
                  viewBox="0 0 28 28"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: "rotate(-90deg)",
                  }}
                  aria-hidden="true"
                >
                  <circle
                    cx={14}
                    cy={14}
                    r={11}
                    stroke="#e2e8f0"
                    strokeWidth={3}
                    fill="none"
                  />
                  <circle
                    cx={14}
                    cy={14}
                    r={11}
                    stroke="#f97316"
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 11}
                    strokeDashoffset={
                      2 *
                      Math.PI *
                      11 *
                      (1 -
                        Math.max(0, Math.min(1, timeLeftSec / timerTotalSec)))
                    }
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f97316",
                  }}
                >
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {Math.max(0, Math.ceil(timeLeftSec))}s
              </div>
            </div>
          </div>
        )}
      {!hidePrompt && (
        <div
          style={{
            fontWeight: 800,
            fontSize: "1.5rem",
            textAlign: "center",
            letterSpacing: "-0.01em",
            marginTop:
              selected === null &&
              typeof timeLeftSec === "number" &&
              typeof timerTotalSec === "number" &&
              timerTotalSec > 0
                ? 64
                : 0,
          }}
        >
          {quiz.prompt}
        </div>
      )}
      {!hideOptions && (
        <QuizOptionsGrid>
          {quiz.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => (selected === null ? onSelect(i) : undefined)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "16px 18px",
                fontSize: "1.25rem",
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
        </QuizOptionsGrid>
      )}
      {children}
    </Panel>
  );
}
