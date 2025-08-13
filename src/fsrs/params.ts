import type { FsrsParameters } from "./types";

// Default parameters for FSRS-4.5 (commonly used seed). Keep as-is unless optimized per user.
export const DEFAULT_FSRS_PARAMETERS: FsrsParameters = {
  w: [
    0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
    0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
  ],
};
