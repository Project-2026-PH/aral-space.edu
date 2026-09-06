# Local Adaptive Authoring Preferences

The quiz generator learns lightweight authoring preferences from the way a user creates, edits, and removes questions. The preference engine is deliberately local and conservative: it stores aggregate measurements in the browser, sends only bounded numeric and categorical signals to the generation endpoint, and never stores or transmits question text, answers, or source material as part of the preference record.

## Goals

The engine is intended to reduce repetitive authoring adjustments over time by helping generation align with a user's established style. It can learn patterns such as:

- Common question modes, including multiple choice, typed answer, identification, true/false, and enumeration.
- Typical question-stem length.
- Typical number of visible options.
- Typical explanation length.
- How often questions are edited or deleted after creation.

It does **not** replace explicit author choices. Source-grounding, required generation formats, selected pipeline modes, and direct edits remain authoritative.

## Architecture

The implementation is split into four layers:

1. **Core signal engine** — `packages/core/src/services/ai/AuthoringPreferenceEngine.ts`
   - Maintains bounded aggregate counters and running averages.
   - Applies a confidence threshold before preferences affect a profile.
   - Converts signals into the existing `UserAuthoringProfile` format.
2. **Browser-local persistence** — `apps/web/lib/authoringPreferences.ts`
   - Stores versioned signals under `quiz-creator:authoring-preferences:v1`.
   - Records only aggregate measurements.
   - Treats preference learning as optional; storage failures never block authoring.
3. **Authoring event capture** — web question creation and editing components
   - `AiQuizGenerator.tsx` reads the local signals before generation.
   - `ManualQuizCreator.tsx` records successfully created manual questions.
   - `QuizQuestionFormModal.tsx` records successful creates and edits.
   - `QuizQuestionList.tsx` records successful deletes.
4. **Server-side profile integration**
   - `request-validation.ts` validates the signal payload and applies strict bounds.
   - `QuizGenerationController` passes validated signals to `UserAuthoringProfileService`.
   - `UserAuthoringProfileService` merges them into the server-authoritative profile.
   - Existing Gemini and Groq prompt adaptation consumes the resulting profile.

### Generation flow

```text
Question create/edit/delete
          │
          ▼
Browser aggregate signal state
(localStorage, no question content)
          │
          ▼
AI generation request
(validated counts and averages only)
          │
          ▼
Server builds saved-quiz profile
          │
          ▼
Server merges confident local signals
          │
          ▼
Gemini/Groq generation prompt
``` 

The server still analyzes saved quiz content through `UserAuthoringProfileService`. Client signals are supplemental behavior signals, not a replacement for server-side profile construction.

## Stored signal shape

The persisted versioned record has this logical shape:

```ts
interface AuthoringPreferenceSignals {
  version: 1;
  observationCount: number;
  createCount: number;
  editCount: number;
  deleteCount: number;
  questionTypeCounts: {
    multiple_choice: number;
    typed_answer: number;
    identification: number;
    true_false: number;
    enumeration: number;
  };
  averageQuestionLength: number;
  averageOptionCount: number;
  averageExplanationLength: number;
}
```

`questionTypeCounts` records observations after successful creates or edits. Edits increment `editCount` and contribute the resulting question snapshot to the running averages. Deletes increment `deleteCount` but do not add a question observation.

The engine caps observation and event counters at 500. Numeric measurements are bounded before persistence and bounded again when received by the server. This protects localStorage from unbounded growth and prevents oversized or malicious request values from influencing the profile.

## Confidence and adaptation rules

Personalization is inactive until at least **three successful question observations** exist. Before that threshold, the existing profile is returned unchanged.

Once the threshold is reached, the engine may add:

- A preferred question type when one type represents at least half of the observed type counts.
- The observed average question length.
- The observed average visible option count when it is at least two. Sparse or typed-answer cards do not cause the system to recommend zero or one option for standard multiple-choice generation.
- The observed average explanation length.
- The number of edits made by the user.

A confidence value increases gradually with observations and is capped at `1.0` after ten observations. The preference description is appended to the existing style summary rather than replacing it.

The engine uses running averages instead of storing individual events. This keeps the local record small and prevents old question content from being recoverable from the preference store.

## Privacy and security

The local record intentionally excludes:

- Question prompts.
- Correct answers and distractor text.
- Explanations.
- Uploaded notes, PDFs, or source pages.
- Quiz titles and identifiers.

The generation request carries only the aggregate `authoringSignals` object. The request parser validates its version, counters, question-type keys, and numeric ranges. Prompt exemplars and source-derived style information remain server-authoritative; the client cannot replace the server's `authoringProfile`.

Because this is browser-local state, preferences are isolated to the current browser profile and can disappear when browser storage is cleared. There is currently no cross-device synchronization or user-facing reset control. To reset the learned preferences manually, clear the `quiz-creator:authoring-preferences:v1` localStorage key for the application origin.

## Explicit choices remain authoritative

The engine does not rewrite an existing question and does not change the question type, option values, answer, or explanation selected by the user. It only supplies aggregate context for future AI generation.

The current AI providers still receive their required generation constraints. For example, the Gemini prompt continues to require four plausible multiple-choice options even if a user's locally authored cards are sparse. The local deterministic generator also remains source-grounded and currently consumes the existing target-count profile; style and exemplar fields are primarily used by the provider-backed prompt pipelines.

## Extension points

Potential future extensions should preserve the same boundaries:

- Add a user-facing reset or disable preference control.
- Add decay or recency weighting to reduce the influence of old authoring behavior.
- Add an opt-in cross-device profile repository without storing question content.
- Add more aggregate signals, such as preferred explanation structure or common source-import transformations.
- Add a profile preview so users can see and correct learned preferences.

Any new signal should have a fixed bound, a clear confidence rule, and a privacy review before being added to the request payload.

## Validation

The engine has focused coverage in:

- `packages/core/src/services/ai/__tests__/AuthoringPreferenceEngine.test.ts`
- `packages/core/src/services/ai/__tests__/UserAuthoringProfileService.test.ts`
- `packages/controllers/src/__tests__/QuizGenerationController.test.ts`
- `apps/web/lib/__tests__/requestValidation.test.ts`

Recommended checks after changing the engine are:

```bash
pnpm --filter @quiz-creator/web typecheck
pnpm exec vitest run packages/core/src/services/ai/__tests__/AuthoringPreferenceEngine.test.ts packages/core/src/services/ai/__tests__/UserAuthoringProfileService.test.ts packages/controllers/src/__tests__/QuizGenerationController.test.ts apps/web/lib/__tests__/requestValidation.test.ts
git diff --check
```
