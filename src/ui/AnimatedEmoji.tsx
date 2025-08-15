import React, { useEffect, useMemo, useRef } from "react";

type AnimatedEmojiProps = {
  codepoint: string; // e.g. "1f389" (lowercase, no 0x, hyphen-separated for multi-codepoint)
  size?: number; // pixels
  loop?: boolean;
  autoplay?: boolean;
  speed?: number; // 0.5..2
  // positioning helpers for overlays
  style?: React.CSSProperties;
  className?: string;
};

// Lightweight wrapper around the lottie-player web component
export function AnimatedEmoji({
  codepoint,
  size = 80,
  loop = true,
  autoplay = true,
  speed = 1,
  style,
  className,
}: AnimatedEmojiProps) {
  const ref = useRef<any>(null);

  const src = useMemo(() => {
    // Noto emoji animated lottie paths on fonts.gstatic
    // Pattern: https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/lottie.json
    // Example: 1f389 (party popper)
    return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/lottie.json`;
  }, [codepoint]);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    try {
      el.setSpeed?.(speed);
    } catch (_) {}
  }, [speed]);

  // Render as the web component to avoid extra deps
  return React.createElement("lottie-player", {
    ref,
    autoplay,
    loop,
    src,
    style: {
      width: size,
      height: size,
      willChange: "transform, opacity",
      contain: "layout paint size style",
      ...(style || {}),
    },
    className,
    mode: "normal",
    background: "transparent",
  } as any) as any;
}

export function emojiCode(
  name: "success" | "fail" | "again" | "hard" | "good" | "easy" | "hint"
): string {
  switch (name) {
    case "success":
      return "1f389"; // party popper
    case "fail":
      return "1f62d"; // loudly crying face
    case "again":
      return "1f649"; // disappointed
    case "hard":
      return "1f914"; // flexed biceps
    case "good":
      return "1f44d"; // thumbs up
    case "easy":
      return "1f60e"; // smiling face with sunglasses
    case "hint":
      return "1f4a1"; // light bulb
    default:
      return "1f389";
  }
}
