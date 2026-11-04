# Enumeration Integration Technical Design

## Overview

Implement enumeration as a term-aware interaction across the existing Next.js App Router/React/TypeScript web application, `@quiz-creator/types`, `packages/core` repositories/services, and the current `useQuizSession` mastery controller. Numeric `answer_text` remains the enumeration quota; it is never displayed or evaluated as an answer term. A persisted `answer_terms` field is the canonical answer-key source for new and empty-option questions, while legacy non-empty `options` is the fallback. Because the requested Multiple Choice behavior requires wrong selections, a separate persisted `enumeration_distractors` field is added; arbitrary legacy `options` are never silently treated as both terms and distractors.

The implementation is deliberately additive. Existing non-enumeration rendering, scoring, URLs, mastery transitions, privacy rules, and typed-answer normalization remain unchanged. Enumeration state is handled by pure utilities and an extension to `useQuizSession`; controls remain in `QuizQuestionRenderer` and the standalone `FlashcardReview`.

## Canonical model, precedence, and persistence

Add to `packages/types/src/models/QuizQuestion.ts`:

```ts
answer_terms?: string[] | null;
enumeration_distractors?: string[] | null;
```

`answer_terms` is the canonical ordered term list. `enumeration_distractors` is an optional ordered list used only as wrong Multiple Choice options; it is never accepted as a correct answer. Add both fields to the create/update DTOs, public/internal question DTOs, API schemas, database schema/migration, and every repository row mapper/serializer in `packages/core/src/repositories`. Existing rows with either field absent continue to load.

Validation at the API/repository boundary requires arrays containing strings only, trims entries, removes blank entries, and applies the same maximum item count and per-item length limit as ordinary options. A malformed persisted value means a non-array, a non-string member, or a value exceeding limits; it is marked unavailable and is not silently replaced by legacy options. Missing/null means the field was not supplied. A valid empty array is authoritative and intentionally means “no terms”; it also suppresses legacy fallback. The value is never logged with answer contents.

`getEnumerationMetadata(question)` in `apps/web/lib/quizAnswerEvaluation.ts` (or a directly imported `enumerationAnswerEvaluation.ts`) returns `{ total, terms, distractors, status, reason }`. Terms are trimmed, non-empty, stable-first-seen values and deduplicated using the same answer-equivalence policy as `areAnswersEquivalent`; each has a deterministic normalized identity key. If `answer_terms` is missing/null, non-empty legacy `options` supplies terms. If `answer_terms` is valid, including `[]`, it is authoritative. Malformed `answer_terms` returns `status: 'unavailable', reason: 'malformed_terms'` with no fallback. Distractors use only validated `enumeration_distractors`; duplicates of canonical terms or of one another are removed, and distractor identity is distinct from canonical identity.

The quota decision table is normative:

| Data | `total` and status |
|---|---|
| `answer_text` is a positive integer equal to the number of non-empty legacy options | retain it; evaluate canonical terms against that quota |
| `options` is empty and `answer_text` is a positive integer | retain it; terms must come from `answer_terms` |
| `answer_text` is missing, blank, non-integer, zero, or negative; legacy options have N non-empty entries | derive `total = N` |
| positive `answer_text` differs from a non-empty legacy-option count | derive `total = N` (legacy compatibility rule); explicit `answer_terms` still supplies terms |
| no recoverable terms or unique terms fewer than `total` | preserve the computed positive total but return `unavailable` with `missing_terms` or `insufficient_terms` |
| computed total is zero | `invalid`, unavailable |

Thus `answer_text: "3"` with two legacy options uses total 2; `answer_text: "3"` with empty options uses total 3 and requires three canonical terms. The utility never changes a quota to `terms.length` merely to make a question answerable. `getQuestionAnswer` continues returning the numeric enumeration total for legacy consumers.

`enumeration_distractors` is round-tripped through `QuizQuestionFormModal.tsx` and `ManualQuizCreator.tsx`. The enumeration editor has an independent “Answer terms” list, an optional positive integer “Total terms” field defaulting to the current numeric quota or the term count, and an optional “Multiple Choice distractors” list. It permits `options: []`; saving sends `{ question_type: 'enumeration', options: [], answer_text: String(total), answer_terms, enumeration_distractors }`. The form rejects non-positive/non-integer totals, malformed entries, and a save with fewer unique canonical terms than the positive total (unless the existing product explicitly supports draft repair; this design chooses rejection). Legacy enumeration options are imported into the answer-term editor on first edit and are not duplicated into distractors. Add form/API round-trip tests for empty options and the exact payload.

## Shared evaluation, quota, and state transitions

Add pure, unit-testable functions/types in `apps/web/lib/quizAnswerEvaluation.ts`: `getEnumerationMetadata`, `createEnumerationState`, `submitEnumerationAttempt`, `projectEnumerationOptions`, and `finalizeEnumerationState`. State is:

```ts
type EnumerationState = {
  questionId: string;
  total: number;
  attempts: Array<{ key: string; rawValue: string; isCorrect: boolean; sequence: number }>;
  attemptedKeys: string[];
  correctKeys: string[];
  wrongKeys: string[];
  status: 'active' | 'complete' | 'unavailable';
  verdict: boolean | null;
};
```

A submission trims and normalizes the value, rejects blank input, and ignores an already-attempted equivalent identity without changing state or emitting telemetry. Otherwise it records exactly one attempt. `selectedOption` is `attemptedKeys.length`, capped by `total`; wrong attempts consume quota but never enter `correctKeys`. Completion occurs exactly at `attemptedKeys.length === total`; verdict is true only when every required canonical identity is in `correctKeys` and `wrongKeys` is empty. The canonical-term check is based on the complete required set, not merely the number of correct attempts.

`projectEnumerationOptions` returns canonical terms as correct options and validated distractors as incorrect options with stable IDs. It never creates a choice from `answer_text`. It returns no selectable options for unavailable metadata. `useQuizSession` owns this state and exposes `enumerationState`, `submitEnumerationTerm`, and `selectEnumerationOption` to the renderer. Enumeration actions do not invoke the ordinary transition after the first selection. At quota completion, the hook calls `calculateAnswerTransition` once with the final verdict, records final mastery/telemetry, queues the existing recap/advance flow, and emits one answer event per distinct attempt. Duplicate attempts emit neither event nor transition. “Don’t know” is one wrong attempt while active. Ordinary questions continue through the existing `answerQuestion` path.

Persist `enumerationByQuestionId` in `apps/web/lib/quizProgressPersistence.ts` and the snapshot type. Current snapshots are version 1; new snapshots are version 2. Version 1 loads with an empty enumeration map. Version 2 records are validated against freshly loaded metadata; malformed per-question records are dropped while the rest remains restorable. A changed question ID, quota, or canonical identity set clears only that question’s record. Snapshot/storage failure is recoverable and preserves in-memory state. Pending events and queue transitions use existing persistence and cannot be duplicated on restore.

## Flashcards

Modify `apps/web/components/quiz/FlashcardReview.tsx` to use metadata instead of its single-answer helper for enumeration cards. On flip, visible enumeration terms render in stable order in a responsive two-column grid at `sm` and wider breakpoints and one column on narrow screens. Show the numeric total only as supporting metadata. If the public/shared answer key is hidden, render the existing hidden-key message and no terms. If metadata is unavailable, render “Answer key unavailable” without fabricating terms. Speech joins visible canonical terms; hints use the shared privacy-safe helper. Non-enumeration answer rendering is unchanged. Add component tests for privacy, responsive term output, unavailable keys, and legacy cards.

## Identification

In `apps/web/components/quiz/QuizQuestionRenderer.tsx`, add an enumeration-specific Identification branch. The input accepts one term per submit and stays enabled while state is active. Show an accessible live counter `Selected n/total`, per-attempt correct/incorrect feedback, and retain a de-duplicated list of submitted terms. Equivalent repeated values are ignored and do not advance progress. Empty input and submissions after completion are ignored. The final verdict appears only at quota completion: correct requires every canonical term and no wrong attempt; otherwise it is incorrect. The completed panel shows canonical terms and submitted attempts. Controls disable after completion, and focus moves to the final verdict/continue control. An unavailable key displays “Answer key unavailable; this question cannot be answered until its answer terms are repaired.” and cannot produce mastery.

## Multiple Choice

Add an enumeration multi-select branch to `QuizQuestionRenderer.tsx`. It receives projected canonical/distractor options and enumeration state. Each unselected option can be clicked once; selected options remain rendered and disabled. Correct selected options use the requested green border and reduced opacity; wrong selected options use destructive/wrong styling and reduced opacity. The list is not replaced after a selection. A live counter shows `Selected n/total`; controls stop accepting input at quota, then display the final verdict and answer review. `aria-pressed`, disabled state, and per-option status expose the state to keyboard and assistive technology. Keyboard shortcuts must not re-submit selected IDs. If the key is unavailable, choices are disabled and the question cannot be marked correct. The existing single-selection branch and styling are untouched for non-enumeration questions.

## Adaptive Learn and `/review/test`

Keep `QuizMode` backward compatible and use existing `mode: 'learn'` as the adaptive mode; no new persisted enum is introduced. Add a pure dispatcher in `apps/web/lib/learnModeDispatcher.ts` with `getLearnInteraction(question): 'enumeration' | 'true_false' | 'multiple_choice' | 'typed_answer'` and `toTrueFalseQuestion(question): { question: QuizQuestion; sourceQuestionId: string }`. The true/false predicate is exact: a non-enumeration question with exactly two trimmed choices whose normalized values are one True-like and one False-like pair (`true`/`false`, case-insensitive); ordinary two-choice terms do not qualify. The transformation preserves source ID, option correctness, and all explanation fields. Dispatch order is available enumeration, valid true/false, ordinary multiple choice with choices, ordinary typed-answer, then existing typed fallback. Learn enumeration never evaluates numeric `answer_text` as a term.

Add `apps/web/app/(app)/review/test/[quizId]/page.tsx` using the same loading contract as `apps/web/app/(app)/practice/[quizId]/page.tsx`: parse `quizId`, `shareToken`, `subjectShareToken`, `shuffleQuestions`, and `shuffleOptions`; resolve slug/legacy IDs through `resolveQuizRoute`; preserve query parameters on redirects; apply existing owner/shared/subject-shared authorization; load questions with `getQuestionsByQuizId` when embedded questions are absent; call `MasterySessionController.getOrStartSession(resolvedQuizId, 'initial', userId, questions)`; render `QuizRunner` with `mode="learn"`. Missing/unauthorized quizzes use existing `notFound`/error behavior. The static `review/test` segment is defined before dynamic `review/[quizId]` resolution. Update the reviewer/test navigation symbol in the existing review navigation component (identified during implementation by searching links to `/review` and `/practice`) to link to `/review/test/${quiz.slug || quiz.id}` while preserving share tokens. Add a checked-in route/runtime test that requests the exact URL for owner, shared, subject-shared, legacy redirect, and missing-quiz cases, asserting adaptive `QuizRunner` output and rejecting 404/flashcard-only output.

## Error handling, privacy, and invariants

Repository/API validation owns field shape, item limits, and malformed persisted values. `getEnumerationMetadata` owns quota/unique-term invariants so every UI mode agrees. The route/data boundary and component visibility guard own public answer-key privacy. `useQuizSession` owns final correctness, mastery, telemetry, and transition invariants; individual controls cannot lock a question directly. Missing/invalid keys are recoverable UI errors but never successful mastery. Repository/session failures remain fatal and follow existing route error handling. Diagnostics log only reason/question ID, once per session boundary, never answer terms.

## Exact files and integration points

Modify `packages/types/src/models/QuizQuestion.ts`, all relevant DTOs, SQL schema/migration, repository row mappers, and question create/update API validation/serialization. Modify `apps/web/lib/quizAnswerEvaluation.ts`, add `apps/web/lib/learnModeDispatcher.ts`, modify `apps/web/lib/quizProgressPersistence.ts`, `apps/web/hooks/useQuizSession.ts`, `apps/web/components/quiz/QuizQuestionRenderer.tsx`, `apps/web/components/quiz/FlashcardReview.tsx`, and `apps/web/components/quiz/QuizRunner.tsx`. Modify `apps/web/components/quiz/QuizQuestionFormModal.tsx`, `ManualQuizCreator.tsx`, generated-question mapping if needed, and add `apps/web/app/(app)/review/test/[quizId]/page.tsx`. Reuse `areAnswersEquivalent`, `calculateAnswerTransition`, `MasterySessionController`, `resolveQuizRoute`, and current repository authorization rather than duplicating them.

## Test plan

Unit tests cover the quota decision table; missing/null/valid-empty/malformed `answer_terms`; trimming, equivalence, stable deduplication; insufficient terms; distractor projection; true/false predicate/transformation; duplicate suppression; quota transitions; wrong-count/final-verdict separation; and ordinary-question regressions. Repository/API/form integration tests create, update, and reload `{ options: [], answer_text: '3', answer_terms: ['A','B','C'], enumeration_distractors: ['X'] }` exactly. Component tests cover flashcard grid/privacy, identification multi-submit and live status, multiple-choice preserved correct/wrong styling, quota completion, disabled duplicates, unavailable keys, and adaptive dispatch. Session tests cover version-1 migration, malformed-record partial restore, mid-enumeration reload, telemetry deduplication, and final mastery. Route tests cover all owner/shared/subject-shared/redirect/missing cases and verify `QuizRunner`, not `FlashcardReview`. Run affected package typecheck/lint/unit/build commands and a browser smoke test for `/review/test`, including correct/wrong/duplicate enumeration attempts and reload at partial quota.

## Review finding resolutions

1. **Wrong Multiple Choice attempts:** resolved by adding validated, persisted `enumeration_distractors`; canonical terms remain correct and distractors are explicit wrong choices.
2. **Empty-option authoring:** resolved with an independent answer-term editor, quota input/default, distractor editor, exact save payload, and form/API validation.
3. **Positive inconsistent quota:** resolved with the normative decision table; non-empty legacy options determine the derived quota, while empty options preserve positive numeric quota.
4. **Malformed precedence:** resolved by distinguishing missing/null fallback, valid empty authoritative suppression, and malformed unavailable/no fallback.
5. **Equivalent duplicates:** resolved by stable equivalence deduplication before comparing unique terms with quota; insufficient keys are unavailable.
6. **`/review/test`:** resolved with an exact route, complete loading/authorization contract, navigation integration, and checked-in runtime route assertions.
7. **True/false contract:** resolved with an exact predicate and source-preserving transformation signature.
8. **Snapshot migration:** resolved with current version 1, new version 2, version-1 initialization, and per-record drop-on-malformation behavior.
