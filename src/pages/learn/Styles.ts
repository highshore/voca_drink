import styled from "styled-components";

export const PageGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
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
`;

export const Panel = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
`;

export const Button = styled.button`
  border: 1px solid #e2e8f0;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
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
  padding: 14px 22px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 110px;
  background: ${(p) => p.bg};
`;

export const KanaRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 16px;
  justify-content: center;
`;

export const Kana = styled.div`
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

export const Kanji = styled.div`
  font-size: 30px;
  color: #64748b;
  font-weight: 600;
`;
