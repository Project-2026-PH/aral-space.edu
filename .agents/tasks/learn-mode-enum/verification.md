# Verification

- `pnpm exec vitest run apps/web/lib/__tests__/quizAnswerEvaluation.test.ts packages/core/src/services/__tests__/QuizTransformService.test.ts` — passed, 2 files / 25 tests.
- `pnpm --filter @quiz-creator/types typecheck` — passed.
- `pnpm --filter @quiz-creator/core typecheck` — passed.
- `pnpm --filter @quiz-creator/web typecheck` — passed.
- `pnpm --filter @quiz-creator/web build` — passed; Next.js production build completed successfully.
- `git diff --check` — passed.

## Review iteration

- Updated the canonical question discriminator to `question_type: 'enumeration'`, preventing ordinary typed-answer cards from being inferred as enumeration.
- Numeric enumeration keys are accepted when they match the non-empty item count; malformed/stale keys derive the item count, while an explicit key is retained for empty-options rows.
- `pnpm exec vitest run apps/web/lib/__tests__/quizAnswerEvaluation.test.ts packages/core/src/services/__tests__/QuizTransformService.test.ts` — passed, 2 files / 28 tests.
- `pnpm --filter @quiz-creator/types typecheck` — passed.
- `pnpm --filter @quiz-creator/core typecheck` — passed.
- `pnpm --filter @quiz-creator/web typecheck` — passed.
- `pnpm --filter @quiz-creator/web build` — passed; Next.js production build completed successfully.
- `git diff --check` — passed.
