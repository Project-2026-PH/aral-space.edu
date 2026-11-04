# Enumeration Integration Requirements

## Summary

Change enumeration questions from being treated only as numeric typed-answer cards into a shared, term-aware interaction across Flashcard, Identification, Multiple Choice, and Learn Mode. The numeric `answer_text` remains the enumeration quota/count, including when `options` is empty; it must not be used as the answer-term key. Existing non-enumeration behavior must remain unchanged.

Current source facts verified directly:

- `QuizQuestionType` currently supports `multiple_choice`, `typed_answer`, and `enumeration`; `QuizMode` already includes `learn` but has no combined/adaptive mode value.
- `getQuestionAnswer` intentionally returns the numeric enumeration count, deriving it from non-empty `options` unless a valid numeric `answer_text` is present. Existing tests cover empty-option numeric persistence and Learn numeric evaluation.
- `useQuizSession` currently stores one `selectedOptionId`, one typed input, and one answer result per question. `answerQuestion` immediately creates a normal mastery transition, so enumeration quota progress cannot currently be represented.
- `FlashcardReview` has a separate flashcard implementation and currently displays one answer string (`answer_text`, then one option fallback).
- `QuizRunner` and `QuestionRenderer` support Learn, Identification, Multiple Choice, Flashcard, and reverse modes, but enumeration-specific interaction is absent.
- `apps/web/app/(app)/review/[quizId]/page.tsx` renders `FlashcardReview` only. No `/review/test` source route or link was found by targeted search; this must be verified at runtime/build and implemented as required rather than assumed absent.

## User Stories

1. As a learner studying an enumeration, I can see or recall each answer term while the stored numeric value continues to define how many terms are required.
2. As a learner using Flashcards, I can flip an enumeration card and see every available answer term in a readable two-column layout.
3. As an Identification learner, I can submit terms one at a time until the enumeration quota is reached, receive per-term feedback, and then see one final verdict based on all required terms.
4. As a Multiple Choice learner, I can select several terms for an enumeration, see each selected term remain visibly correct or incorrect, and finish when the quota is reached.
5. As a Learn/combined-mode learner, I receive an adaptive mix of true/false, multiple choice, and enumeration interactions without losing existing mastery/progress behavior.
6. As a learner, repeated clicks or repeated typed terms do not inflate progress or create inconsistent final results.

## Functional Requirements

### Canonical enumeration answer data and interaction model

1. The system MUST distinguish `enumerationTotal` from `enumerationTerms`:
   - `enumerationTotal` is the positive integer quota. It is read from a valid numeric `answer_text`; if unavailable or inconsistent with legacy populated options, it is derived from the count of non-empty option entries, preserving current compatibility rules.
   - `enumerationTerms` is the ordered, trimmed, non-empty set of answer terms. Duplicate terms MUST be deduplicated using the same answer-equivalence policy used by the core (`areAnswersEquivalent` or a shared equivalent-term key), while retaining stable first-seen order.
2. `answer_text` MUST remain numeric for enumeration and MUST NOT be interpreted as the term list. Existing empty-option rows therefore require an additional canonical term source before they can provide term-based Identification or Multiple Choice. The preferred model is an explicit persisted `answer_terms: string[]` (or an equivalent namespaced enumeration answer-key field) on `QuizQuestion`, with validation and repository round-trip support. For backward compatibility, non-empty `options` are the fallback term source.
3. If an enumeration has a positive total but no recoverable terms, the UI MUST not fabricate terms from the number. It MUST expose a safe unavailable-answer-key state (and log a diagnostic at the owning boundary) and disable term-dependent selection/submission or provide a clearly defined fallback pending author correction. This condition must be visible in implementation verification.
4. A shared utility layer MUST expose normalized enumeration metadata and selection transitions for all modes. It MUST own trimming, case/whitespace-equivalent matching, duplicate suppression, quota calculation, and final correctness (`all required canonical terms selected`; wrong selections do not make the final result correct).
5. Enumeration progress MUST be represented as unique accepted/attempted term identities, not raw click count. The user-facing counter is `selectedOption/TotalEnumeratedOption`; `selectedOption` increases at most once per distinct selectable term/typed equivalent and is capped at the total. Wrong terms count toward the quota, but the final verdict is false unless every required term was correctly selected/entered.

### Learn Mode and adaptive `/review/test`

6. Starting Learn Mode for a set containing enumeration questions MUST route enumeration questions through the enumeration interaction model rather than asking the numeric count as if it were the answer term. Non-enumeration Learn behavior remains unchanged.
7. The missing `/review/test` behavior MUST be resolved by inspecting the running route table and navigation entry points. If `/review/test` is the intended test/reviewer URL, it MUST render a `QuizRunner`-backed combined adaptive mode. The mode MUST choose true/false where a valid two-choice question exists, multiple choice where selectable choices exist, and enumeration behavior for enumeration questions; it MUST preserve session persistence, mastery, explanations, and completion flows.
8. If `/review/test` is a stale/incorrect reported URL and the actual intended route differs, provide a compatibility redirect or documented route decision, plus a runtime verification artifact/test. Do not silently remove the reported requirement.
9. The adaptive mode MUST not reinterpret ordinary typed-answer or non-enumeration questions as enumeration and MUST preserve existing mode selection URLs and behavior.

### Flashcard

10. For an enumeration question, flipping the card MUST render all canonical answer terms, ordered consistently with the stored key, in two responsive columns on wider layouts and a readable single-column fallback on narrow layouts. The numeric total may be shown as metadata but not as the only answer.
11. Existing answer-key visibility rules for public/shared cards MUST apply to every enumeration term. When the key is hidden, no term may leak.
12. Speech/hint/answer display must use the same canonical answer data and must not regress ordinary cards.

### Identification

13. For enumeration questions, the input MUST accept one term per submission and prompt for another term until the quota is reached. It MUST display progress as `selectedOption/TotalEnumeratedOption`.
14. Each submission MUST be classified against the canonical term set using existing answer-equivalence behavior. Correct and incorrect submissions both consume one unique quota slot; repeated equivalent submissions MUST not consume another slot and MUST provide feedback without advancing progress.
15. The final verdict MUST be shown only after the quota is reached. It is correct only if all required canonical terms were entered correctly; any wrong submission makes it wrong even though it counts toward completion. The final result must show the complete answer key and the learner’s submitted terms, with duplicates safely collapsed.
16. Empty input, whitespace-only input, malformed/unavailable keys, and submissions after completion MUST be rejected or ignored without mutating progress. “Don’t know” counts as one wrong attempt only when the current enumeration slot is otherwise eligible, matching the stated quota rule.

### Multiple Choice

17. For enumeration questions, selectable choices MUST be the canonical answer terms (plus any explicitly configured distractors if the data model supports them). A numeric count alone MUST never be offered as the only choice. If no terms/choices exist, use the safe unavailable-key behavior rather than inventing options.
18. A learner may select multiple distinct choices. After each selection, the option MUST remain disabled or otherwise non-repeatable and visibly preserve status: correct selections use green border plus reduced opacity; incorrect selections use corresponding wrong/destructive styling plus reduced opacity.
19. Selection progress MUST use unique selections and stop accepting selections once `selectedOption` reaches `TotalEnumeratedOption`; wrong selections still consume quota. The final verdict MUST be correct only when all required terms were selected and no wrong selection occurred.
20. The final verdict and answer review MUST appear after the quota is reached, not after the first click. Existing single-answer Multiple Choice interaction and styling must remain unchanged for non-enumeration questions.

### Persistence, telemetry, and repositories

21. Enumeration in-progress state MUST survive the existing local snapshot/session restoration where the mode supports saved progress: selected/attempted term identities, per-term correctness, quota, and final status must be persisted or safely reset together.
22. Answer events and telemetry MUST record each distinct enumeration submission/selection without double-counting duplicate selections. Session completion/mastery must use the final enumeration verdict, while quota completion remains independent from correctness.
23. Repositories, DTO validation, API serialization, and shared types MUST round-trip the canonical term source without dropping it. Existing rows and clients without the new field must continue to load.

## Non-Functional Requirements

- Preserve existing non-enumeration behavior exactly, including typed-answer normalization, answer-equivalence tolerance, mastery transitions, public answer-key restrictions, and existing mode URLs.
- Prefer shared pure utilities/state transitions over separate Flashcard, renderer, and hook implementations; utilities must be deterministic and unit-testable.
- Keep accessible controls and status announcements: quota progress, selected correct/wrong state, final verdict, disabled duplicate selections, and unavailable answer key must be perceivable by keyboard and assistive technology.
- Do not expose hidden public/shared answer terms through client payloads or rendered markup.
- Avoid changing persisted numeric enumeration semantics while introducing term storage.

## Acceptance Criteria

1. Given an enumeration with populated terms and numeric count, Learn Mode identifies it as enumeration, exposes the terms through the appropriate interaction, and never evaluates the numeric count as a term.
2. Given an enumeration with `options: []`, a persisted canonical term list round-trips through create/update/repository/API loading; Flashcard, Identification, and Multiple Choice use those terms, while the numeric `answer_text` remains the quota.
3. Given a Flashcard enumeration, flipping shows all terms in two columns on desktop/wide view and a usable responsive layout on narrow view; non-enumeration flashcards render exactly as before.
4. Given total 3, submissions `Term A` (correct), `wrong` (wrong), `Term C` (correct) produce progress 1/3, 2/3, 3/3, then show a wrong final verdict; a fourth submission is impossible.
5. Repeating an equivalent typed term or clicking the same choice repeatedly does not increase progress, produce duplicate events, or bypass the quota.
6. Multiple Choice preserves each selected correct option with green/reduced-opacity styling and each selected wrong option with wrong/reduced-opacity styling, then shows the final verdict exactly at the quota.
7. A complete set of required terms selected/entered with no wrong attempt produces a correct final verdict; any wrong attempt produces an incorrect final verdict even when quota completion occurs.
8. `/review/test` is exercised in a browser/runtime route check. It either renders the combined adaptive Learn/Test experience as specified or redirects through the documented compatibility path to it; no blank, 404, or flashcard-only result is accepted.
9. Adaptive mode handles true/false, ordinary multiple choice, ordinary typed-answer, and enumeration questions without changing existing behavior, and mode switching/session restoration do not lose enumeration state.
10. Unit tests cover metadata extraction, empty-option term source, duplicate/equivalent suppression, quota transitions, wrong-count/final-verdict separation, and non-enumeration regressions; integration tests cover route selection, renderer behavior, repository round-trip, and saved-session restoration.
11. Runtime verification records any inability to create a real empty-option enumeration, access `/review/test`, or exercise shared/public answer-key visibility; such limitations remain flagged for implementation verification rather than being treated as disproved.

## Ambiguities and Recommended Decisions

- **Where terms come from when options are empty:** The current schema has no verified term-list field; numeric `answer_text` cannot supply terms. Recommended decision: add `answer_terms: string[]` as the canonical persisted field, fallback to non-empty `options` for legacy rows, and show an unavailable-key state when neither exists. Confirm compatibility with database schema and authoring UI during design/implementation.
- **Whether distractors are allowed in enumeration Multiple Choice:** Recommended decision: initially offer canonical terms only, because wrong selections must be possible to satisfy the stated behavior and no separate distractor model is currently guaranteed. If distractors are required, add an explicit distinction so correctness cannot rely on array position.
- **Meaning of “Learn Mode combined with true/false, multiple choice, and enumeration”:** Recommended decision: implement adaptive Learn/Test as a mode dispatcher using existing question data, not a new persisted question type. Preserve `QuizMode` compatibility unless route/runtime verification proves a new mode identifier is needed.
- **Quota larger than available unique terms:** Recommended decision: treat the key as invalid/unavailable and do not allow false completion through duplicate entries. Log a diagnostic and surface an author-facing/runtime-verifiable error state.
- **Wrong selection and mastery:** Recommended decision: quota completion advances the enumeration interaction, but mastery/final correctness remains false if any wrong attempt occurred; normal retry/struggle behavior may then re-present the question using the existing mastery policy.
- **Flashcard answer-key privacy:** Recommended decision: apply the existing `canViewAnswerKey` policy to the full term list, not just `answer_text`.
- **`/review/test` report:** Targeted source search found no route or link, but this cannot establish that no dynamically generated/legacy route exists. Verify with Next route output, direct browser navigation, and relevant deployment configuration.

## Out of Scope

- Rewriting ordinary multiple-choice, true/false, typed-answer, reverse, or flashcard scoring.
- Changing the meaning or persistence format of numeric enumeration `answer_text`.
- Automatically generating missing answer terms from question text, AI, or the numeric count.
- Introducing a new spaced-repetition/mastery algorithm unrelated to enumeration quota handling.
- Redesigning authoring beyond the minimum UI/schema/API support needed to enter and persist canonical enumeration terms.
- Changing public sharing permissions or exposing answer keys that are currently hidden.
