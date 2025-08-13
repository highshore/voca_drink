# Voca Drink

React + TypeScript + Vite app with Firestore and FSRS scheduling.

## Scripts

- `npm run dev`: Start the dev server
- `npm run build`: Type-check and build
- `npm run preview`: Preview the build
- `npm run lint`: Run ESLint
- `npm run seed:japanese`: Import vocabulary from `japanese.csv`
- `npm run count:japanese`: Count rows in `japanese.csv`
- `node scripts/fsrs-export-logs.mjs --uid=USER_ID [--out=fsrs-review-logs.json]`: Export review logs for FSRS optimization

## FSRS Scheduler (Beta)

This project includes an FSRS-4.5-based scheduler in `src/fsrs/`. When you rate in `LearnPage`, we persist both the legacy SRS (`users/{uid}/srs`) and FSRS (`users/{uid}/fsrs`). The Learn queue prefers FSRS due cards if available.

Files:

- `src/fsrs/types.ts`: core types
- `src/fsrs/params.ts`: default parameters
- `src/fsrs/scheduler.ts`: schedule logic and forgetting curve
- `src/fsrs/optimizer.ts`: simulation and placeholder optimizer
- `src/services/fsrsService.ts`: Firestore integration (entries, due selection, per-user params)
