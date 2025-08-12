import type { CSSProperties } from "react";

export const NAV_HEIGHT = 64;
export const CONTAINER_MAX_WIDTH = 960;
export const CONTAINER_PADDING_X = 20;
export const SPACING = 16;

export const colors = {
  text: "#0f172a",
  muted: "#475569",
  border: "#e2e8f0",
  brand: "#f97316",
  brand600: "#ea580c",
  surface: "#fffdf9",
  white: "#ffffff",
};

export const s = {
  appShell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    color: colors.text,
    background: colors.white,
  } as CSSProperties,
  nav: {
    height: NAV_HEIGHT,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
  } as CSSProperties,
  navInner: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: CONTAINER_MAX_WIDTH,
    margin: "0 auto",
    padding: `0 ${CONTAINER_PADDING_X}px`,
  } as CSSProperties,
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  } as CSSProperties,
  brandBadge: {
    width: 28,
    height: 28,
    background: colors.brand,
    borderRadius: 4,
  } as CSSProperties,
  navButtons: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as CSSProperties,
  container: {
    maxWidth: CONTAINER_MAX_WIDTH,
    margin: "0 auto",
    padding: `0 ${CONTAINER_PADDING_X}px`,
  } as CSSProperties,
  main: {
    padding: "24px 0",
    minHeight: `calc(100vh - ${NAV_HEIGHT}px)`,
  } as CSSProperties,
  footer: {
    borderTop: `1px solid ${colors.border}`,
    padding: "20px 0",
    color: colors.muted,
    fontSize: 14,
  } as CSSProperties,
  button: {
    border: `1px solid ${colors.border}`,
    padding: "8px 14px",
    borderRadius: 8,
    background: colors.white,
    cursor: "pointer",
    fontSize: 14,
  } as CSSProperties,
  buttonBrand: {
    border: "none",
    background: colors.brand,
    color: colors.white,
  } as CSSProperties,
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING,
  } as CSSProperties,
  card: {
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 16,
    background: colors.white,
  } as CSSProperties,
  grid12: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 16,
  } as CSSProperties,
};

export function colSpan(n: number): CSSProperties {
  return { gridColumn: `span ${n}` } as CSSProperties;
}
