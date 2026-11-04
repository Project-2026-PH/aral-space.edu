# Enumeration answer keys in Learn Mode

The change introduces an explicit `enumeration` question discriminator and uses the number of non-empty enumeration items as the Learn Mode answer key. Manual creation and editing persist the item list in `options` and the count in `answer_text`, while answer evaluation reads the numeric key instead of indexing the choices array. The transform layer leaves enumeration cards untouched, and ordinary typed-answer and multiple-choice cards retain their existing fallback behavior. The recorded focused tests, typechecks, and production build all pass.

Watch for: **confirmed** — the implementation plan's repository round-trip and end-to-end persistence verification is not represented in `verification.md`; the recorded evidence covers request validation, answer evaluation, transformation, typechecks, and build, but not an actual repository create/read/update round trip. This leaves the storage boundary less directly proven than the Learn Mode helper itself.

**Verdict**: NEEDS_CHANGES

## High-level view

The canonical representation is now explicit: enumeration cards use `question_type: 'enumeration'`, retain their listed items in `options`, and store the expected count as `answer_text`. Both manual authoring surfaces compute that count from trimmed, non-empty items, and request validation accepts the new discriminator.

Learn Mode resolves enumeration answers before the legacy `answer_text`/`options[correct_answer]` fallback. A valid numeric key is preserved for empty-option rows; for populated rows, missing, malformed, or stale keys fall back to the current non-empty item count. This prevents an empty choices array from producing an empty answer while leaving ordinary typed-answer behavior discriminator-based and unchanged.

The transform service avoids converting enumeration item lists into multiple-choice options. The renderer already routes Learn Mode through typed input, and the session hook records Learn Mode submissions as typed answers through the existing mode path. The remaining verification gap is persistence-level proof that the explicit discriminator and numeric key survive the real repository boundary.

<details>
<summary>Issues (1)</summary>

1. **Repository round-trip coverage** — **confirmed**: the required verification note contains no repository create/read/update or end-to-end persistence result for an enumeration with empty `options` and numeric `answer_text`. Add a focused repository round-trip test (and, if needed, a session-event assertion) proving that `question_type: 'enumeration'` and the numeric key survive storage and are consumed by Learn Mode.

</details>

<details>
<summary>Details</summary>

### Explicit discriminator and authoring behavior

The change improves the prior overloaded representation by making enumeration a first-class `QuizQuestionType` rather than inferring it from a typed-answer row with multiple options. `ManualQuizCreator` trims and removes empty items, persists those items as `options`, and writes `String(filled.length)` to `answer_text`. `QuizQuestionFormModal` preserves an existing enumeration during edits and recomputes the count on save, preventing an edit from silently converting the card back to ordinary typed-answer behavior. Clipboard enumeration imports continue to populate the item list; the count is correctly computed only when a save payload is constructed.

The request validator now permits the new discriminator, and the recorded request-validation tests cover create/update payload acceptance for an empty options array with a numeric answer.

### Learn Mode answer resolution and malformed keys

`getQuestionAnswer` branches only on `question_type === 'enumeration'`. With populated options, it accepts an explicit digit-only key only when it equals the count of non-empty items; otherwise it derives that count. With empty options, it retains a digit-only explicit key, which directly addresses the original failure mode. Duplicate item text is counted as separate entries, matching the authoring representation's item count rather than deduplicating content; a stale key on a populated row is corrected to that count.

The generic fallback remains unchanged for non-enumeration questions, including ordinary `typed_answer` rows whose answer is absent from `answer_text` and must still come from `options[correct_answer]`. The tests explicitly cover that preservation. Learn Mode routing already treats the whole Learn screen as typed input, so adding the discriminator does not require a separate renderer path, and the session event path receives the existing `learn` answer mode.

### Transform and completion semantics

`QuizTransformService.prepareQuestionsForOptions` now returns enumeration cards without treating their item list as multiple-choice candidates. That preserves both the numeric answer key and the display list while retaining the existing sparse-card transformation for other question types. `QuizCompletion` was also narrowed to identify enumeration cards explicitly, so ordinary typed-answer options are no longer rendered as enumeration review text.

The recorded 28-test focused run covers numeric keys with populated and empty options, legacy/malformed enumeration keys, non-enumeration fallback, and transform preservation. The later 36-test run adds request-validation coverage. Typechecks for types, core, and web plus the production web build passed, and `git diff --check` passed.

### Persistence verification gap

The implementation's repository field mapping appears compatible because `answer_text`, `question_type`, `options`, and `correct_answer` already exist in the shared question fields and persistence mappings. However, the verification note does not record the plan's requested repository round-trip test. That omission matters specifically for the empty-options case: static mapping compatibility does not prove that normalization, database serialization, and read hydration preserve the explicit numeric key and discriminator. This is the sole blocking finding.

</details>

<details>
<summary>File map</summary>

- `apps/web/lib/quizAnswerEvaluation.ts` — derives enumeration counts and preserves legacy answer fallback behavior.
- `apps/web/components/quiz/ManualQuizCreator.tsx` — persists enumeration items and numeric answer keys.
- `apps/web/components/quiz/QuizQuestionFormModal.tsx` — preserves and saves enumeration edits.
- `apps/web/lib/request-validation.ts` — accepts the enumeration discriminator.
- `apps/web/components/quiz/QuizCompletion.tsx` — renders enumeration review answers explicitly.
- `packages/types/src/models/QuizQuestion.ts` — adds `enumeration` to the shared question contract.
- `packages/core/src/services/QuizTransformService.ts` — prevents enumeration item lists from being transformed into multiple-choice options.
- `apps/web/lib/__tests__/quizAnswerEvaluation.test.ts`, `apps/web/lib/__tests__/requestValidation.test.ts`, `packages/core/src/services/__tests__/QuizTransformService.test.ts` — focused regression coverage.
- Full implementation diff: `git diff origin/main..HEAD`.

</details>
