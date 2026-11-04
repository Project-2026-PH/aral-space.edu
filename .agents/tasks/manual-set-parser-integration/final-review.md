# Manual-set parser integration review

**Verdict**: NEEDS_CHANGES

## Issues

1. **likely**: The overview add/edit modal can overwrite a user’s subsequent edits with a stale SmolLM2 result. When deterministic parsing returns `null`, `handleClipboardPaste` starts `parseWithSmolLM2(text)` without preventing native paste; `pasteRequestRef` is incremented for that request, but it is not invalidated by edits to `questionText`, `answerText`, or identification options. If the user changes either field before the local model resolves, `applyClipboardCard(aiParsed)` still runs and replaces the prompt and answer. Invalidate the pending request on relevant user input (or otherwise compare the pasted/current value) before applying the asynchronous result.

## Scope checked

The committed changes in `946c53a` and `5b71a3a` were checked across `ManualQuizCreator`, `QuizQuestionFormModal`, `clipboardParser`, `localClipboardParser`, `convertToQuestion`, and the shared clipboard prompt helper. Structured question/answer records remain verbatim, bulk/list/enumeration imports remain on the manual creator’s pending-import path, the one-card modal leaves those formats native, and the local parser is invoked only from client components. Existing unrelated worktree changes, including `apps/web/hooks/useQuizSession.ts`, were not modified or evaluated as part of this review.
