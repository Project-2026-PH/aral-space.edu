# Verification

- `pnpm --filter @quiz-creator/web exec vitest run lib/__tests__/convertToQuestion.test.ts` — passed (1 file, 9 tests), including predicate output ending with `?` without the prior declarative punctuation.
- `pnpm --filter @quiz-creator/web exec vitest run lib/__tests__` — passed (15 files, 160 tests).
- `pnpm --filter @quiz-creator/web typecheck` — passed (`tsc --noEmit`).
- `pnpm --filter @quiz-creator/web lint` — could not run because `eslint` is not installed/resolvable in the web package (`eslint is not recognized as an internal or external command`).
