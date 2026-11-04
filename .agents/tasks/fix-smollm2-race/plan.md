# Implementation Plan

- [ ] 1. Invalidate pending local SmolLM2 clipboard fallback requests when the user edits fields that `applyClipboardCard` replaces. Add `pasteRequestRef.current += 1;` at the start of the question prompt `RichTextEditor` `onChange`, the typed-answer input `onChange`, and the identification answer (`options[0]`) input `onChange`; preserve each handler's existing state updates and do not alter paste parsing or fallback resolution.
      Files: `apps/web/components/quiz/QuizQuestionFormModal.tsx`
      Verify: `pnpm --filter @quiz-creator/web typecheck` completes successfully; `pnpm test -- apps/web/lib/__tests__/clipboardParser.test.ts` passes, confirming the existing deterministic clipboard parser flow remains intact. Also confirm the diff is limited to the three requested user-edit handlers and does not touch `apps/web/hooks/useQuizSession.ts`.
