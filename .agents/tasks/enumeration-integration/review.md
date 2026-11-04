# Enumeration Learn Mode integration

This change adds canonical enumeration metadata, quota-based identification and multiple-choice interactions, responsive flashcard answers, persistence, authoring support, and an adaptive `/review/test/[quizId]` route. The implementation preserves the numeric quota for legacy consumers, adds the new fields to key-enabled projections, and includes a production route entry. Watch for: **confirmed** the required user-facing enumeration and route cases are not covered by focused tests; **confirmed** the full test command failed in the fixer run and browser smoke was not run.

**Verdict**: NEEDS_CHANGES

## High-level view

The metadata path implements legacy fallback, explicit canonical terms, duplicate identity, distractor projection, quota handling, and unavailable-key behavior. Hidden public projections omit the answer-key fields, while key-enabled projections include them.

Enumeration actions remain separate during intermediate attempts and invoke the shared transition boundary only after quota completion. The renderer and Learn route are present, and the production build recognizes `/review/test/[quizId]`, but acceptance-level behavior is not independently demonstrated across the study surfaces and route authorization cases.

The fixer report confirms package and root typechecks plus the web build and focused evaluation/persistence tests. It also records a root `pnpm test` worker failure and unavailable browser automation, leaving integration evidence incomplete.

<details>
<summary>Issues (3)</summary>

1. **Missing enumeration surface coverage** — **confirmed**: the available focused tests cover evaluation and persistence, but not flashcard responsive columns/privacy markup, typed-term quota progression and duplicate suppression, or multiple-choice correct/wrong styling; add focused component/session tests for those acceptance cases.
2. **Learn route contract coverage** — **confirmed**: the route source exists and renders `QuizRunner mode="learn"`, but no focused tests establish owner, shared, subject-shared, legacy-query-preserving redirect, and missing-quiz behavior; add route tests against the practice authorization/loading contract.
3. **Unresolved integration validation** — **confirmed**: the fixer report records `pnpm test` failing with `ERR_IPC_CHANNEL_CLOSED` and says browser smoke was not run; isolate the worker failure or provide reproducible substitute evidence, then exercise route, reload, and correct/wrong/duplicate enumeration flows before approval.

</details>

<details>
<summary>Details</summary>

### Enumeration study behavior remains under-tested

`useQuizSession` gates enumeration attempts separately, suppresses duplicate identities, updates feedback while active, and commits the finalized verdict at quota. `QuizQuestionRenderer` and `FlashcardReview` contain the requested branches, but the repository evidence does not include tests for the responsive two-column/one-column flashcard layout, typed matching and quota completion, duplicate/post-completion suppression, or selected correct and wrong choice styling. These are user-visible acceptance requirements rather than incidental implementation details, so typechecking cannot establish them.

### Learn route behavior is only build-verified

The new sibling page parses the requested query parameters, resolves legacy IDs, checks owner/shared/subject-shared paths, loads questions, starts mastery state, and returns `QuizRunner` in Learn mode. However, the fixer report provides only route-table/build evidence; it does not verify the required authorization, redirect query preservation, missing-quiz `notFound`, or embedded-versus-repository question cases. Those cases need route-level tests before the route can be considered equivalent to `practice/[quizId]`.

### Validation does not establish a clean integration pass

The fixer report records passing package typechecks, root typecheck, focused utility/persistence tests, and the web build, but the required root `pnpm test` stopped after 396 tests because of `ERR_IPC_CHANNEL_CLOSED` in the Neon repository worker. Browser smoke was also unavailable, so partial enumeration reload, retry freshness, and route behavior were not exercised. This is an evidence gap rather than proof of a code defect, but it blocks approval under the stated verification requirements.

The source review found no confirmed hidden-key projection leak: `publicDtos.ts` adds `answer_terms` and `enumeration_distractors` only when `allow_public_answer_key` is true, and ordinary renderer branches remain separate from enumeration handling.

</details>

<details>
<summary>Files changed</summary>

- `apps/web/lib/quizAnswerEvaluation.ts` and `apps/web/hooks/useQuizSession.ts` — enumeration metadata, state, quota submission, and persistence.
- `apps/web/components/quiz/QuizQuestionRenderer.tsx` and `FlashcardReview.tsx` — enumeration study UI.
- `apps/web/lib/learnModeDispatcher.ts` and `apps/web/app/(app)/review/test/[quizId]/page.tsx` — adaptive Learn routing.
- `packages/types`, repositories, schema, and `publicDtos.ts` — answer-key persistence and privacy projection.
- Focused utility, persistence, repository, and validation tests — current coverage.

Full diff: `git diff main` from the repository root.

</details>
