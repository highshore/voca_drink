import styled from "styled-components";

export const PageGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const CardWrap = styled.div`
  min-height: 420px;
  display: flex;
  width: 100%;
  position: relative;
  @media (max-width: 480px) {
    min-height: 360px;
  }
`;

export const Panel = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  @media (max-width: 640px) {
    padding: 24px;
    border-radius: 16px;
  }
`;

export const Button = styled.button`
  border: 1px solid #e2e8f0;
  padding: 16px 30px;
  border-radius: 14px;
  font-size: 1.25rem;
  font-weight: 700;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
`;

export const RateRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: space-between;
`;

export const RateButton = styled.button<{ bg: string }>`
  border: none;
  padding: 16px 24px;
  border-radius: 14px;
  font-size: 1.125rem;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 110px;
  background: ${(p) => p.bg};
  @media (max-width: 480px) {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
    font-size: 1rem;
    padding: 14px 16px;
  }
`;

export const KanaRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 16px;
  justify-content: center;
`;

export const Kana = styled.div`
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  @media (max-width: 480px) {
    font-size: 2rem;
  }
`;

export const Kanji = styled.div`
  font-size: 2.5rem;
  color: #64748b;
  font-weight: 700;
  @media (max-width: 480px) {
    font-size: 1.875rem;
  }
`;

export const QuizOptionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;
