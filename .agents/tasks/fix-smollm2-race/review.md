# Clipboard fallback edit invalidation

The change closes the stale local SmolLM2 clipboard-fallback race in `QuizQuestionFormModal` by advancing `pasteRequestRef.current` whenever a user changes a question prompt or answer value. A fallback callback therefore fails its request-id check instead of applying an older parsed card over the edit. The change is limited to the modal and preserves the existing parser-first path, structured question/answer handling, and native bulk/list behavior; `useQuizSession.ts` is untouched.

Watch for: **confirmed** — no coder verification output was present in the task directory, so the requested typecheck and parser test results could not be independently confirmed in this review.

**Verdict**: APPROVED

## High-level view

The asynchronous fallback now shares the same invalidation boundary as synchronous clipboard application: a user edit increments the request token before updating state, so a stale SmolLM2 result cannot win a race with current input. The four guarded handlers cover the prompt, typed-answer field, identification answer field, and multiple-choice option edits, while leaving parsing and fallback resolution unchanged. The commit does not touch session behavior or introduce unrelated production changes.

<details>
<summary>Issues (0)</summary>

No blocking concerns were found.

</details>

<details>
<summary>Details</summary>

### Request-token invalidation across manual authoring fields

`handleClipboardPaste` captures a monotonically increasing request ID before starting `parseWithSmolLM2`, and the completion path already requires that ID to equal `pasteRequestRef.current`. The new `onChange` handlers increment the ref before applying user input, which makes the pending result stale without cancelling the local request or changing deterministic parser-first behavior. The existing synchronous `question_answer` and `single_pair` paths still apply immediately, and unrecognized bulk/list formats continue to use native paste behavior.

The invalidation is applied to the question rich-text editor, multiple-choice option inputs, the typed-answer input, and the identification answer input. In the identification path, both `options[0]` and `answerText` remain updated together; only the request token behavior is new. No change was made to `apps/web/hooks/useQuizSession.ts`, and the diff contains no changes to parser contracts or add/edit persistence flows.

### Verification coverage

The task directory contains the implementation plan and targeted patch, but no coder verification output. The diff itself provides evidence for the race fix and scope constraints; typecheck and parser-test execution are therefore unverified here. No test suite, build, or typecheck was rerun per instruction.

</details>

<details>
<summary>File map</summary>

- `apps/web/components/quiz/QuizQuestionFormModal.tsx` — invalidates pending SmolLM2 fallback requests from manual field edits.

Full diff: `git show HEAD -- apps/web/components/quiz/QuizQuestionFormModal.tsx`

</details>
