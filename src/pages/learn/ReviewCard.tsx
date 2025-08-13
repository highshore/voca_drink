import {
  Panel,
  KanaRow,
  Kana,
  Kanji,
  Button,
  RateRow,
  RateButton,
} from "./Styles";
import type { Rating } from "../../services/userService";

type JapaneseDoc = {
  id?: string;
  kana: string;
  kanji: string;
  meanings: { ko: string };
  tags?: string[];
  examples?: Array<{
    sentence?: string;
    pronunciation?: string;
    translation?: { ko?: string };
  }>;
};

export function ReviewCard({
  item,
  showAnswer,
  onShow,
  onRate,
}: {
  item: JapaneseDoc;
  showAnswer: boolean;
  onShow: () => void;
  onRate: (rating: Rating) => void;
}) {
  const hasKanji = item.kanji && item.kanji !== item.kana;
  return (
    <Panel style={{ minHeight: 420, padding: 30 }}>
      {showAnswer && (
        <KanaRow>
          <Kana>{item.kana}</Kana>
          {hasKanji && <Kanji>{item.kanji}</Kanji>}
        </KanaRow>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {!showAnswer ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              marginTop: 8,
            }}
          >
            <KanaRow>
              <Kana>{item.kana}</Kana>
              {hasKanji && <Kanji>{item.kanji}</Kanji>}
            </KanaRow>
            <Button onClick={onShow}>Show answer</Button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 600, textAlign: "center" }}>
              {item.meanings?.ko}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {item.tags.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 13,
                      padding: "6px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 999,
                      background: "#f8fafc",
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.examples && item.examples.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  width: "100%",
                }}
              >
                {item.examples.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      color: "#334155",
                      textAlign: "center",
                      padding: "14px",
                      background: "#f8fafc",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}
                    >
                      {ex.sentence}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: "#64748b",
                        marginBottom: 2,
                      }}
                    >
                      {ex.pronunciation}
                    </div>
                    <div style={{ fontSize: 15 }}>{ex.translation?.ko}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAnswer && (
        <RateRow>
          <RateButton bg="#ef4444" onClick={() => onRate("again")}>
            Again
          </RateButton>
          <RateButton bg="#f59e0b" onClick={() => onRate("hard")}>
            Hard
          </RateButton>
          <RateButton bg="#10b981" onClick={() => onRate("good")}>
            Good
          </RateButton>
          <RateButton bg="#3b82f6" onClick={() => onRate("easy")}>
            Easy
          </RateButton>
        </RateRow>
      )}
    </Panel>
  );
}
