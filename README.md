# Voca Drink

React + TypeScript + Vite app with Firestore and FSRS scheduling.

## Scripts

- `npm run dev`: Start the dev server
- `npm run build`: Type-check and build
- `npm run preview`: Preview the build
- `npm run lint`: Run ESLint
- `npm run seed:japanese`: Import vocabulary from `japanese.csv`
- `npm run count:japanese`: Count rows in `japanese.csv`

## Spaced Repetition

We use a 3-box Leitner system stored under `users/{uid}/leitner`:

- Box 1: review every 1 day
- Box 2: every 3 days
- Box 3: every 5 days

When the user answers an MCQ correctly, the card is promoted by one box (max 3); on incorrect, demoted by one box (min 1). Scheduling is persisted with `dueAt` timestamps. See `src/services/leitnerService.ts`.
