# Deterministic reference-substitution question converter

The change adds the requested standalone `convertToQuestion(text: string, term: string): string` utility and focused Vitest coverage. It performs local deterministic regex/string transformations, escapes caller-provided terms, matches case-insensitively with word boundaries, handles all four requested leading prepositions, rewrites later mentions, and guarantees a final question mark when the transformed result does not already end with one. The matrix example and specified edge cases are covered, and the recorded focused tests, package test suite, and typecheck passed; lint could not run because ESLint is unavailable in the package. Watch for: no blocking implementation findings; lint could not be executed in the recorded environment (**confirmed**).

**Verdict**: APPROVED

## High-level view

The converter is isolated from parser and AI/provider modules and uses only escaped regular expressions and string replacement. Empty text, blank terms, absent terms, and non-boundary matches remain unchanged, while matched input receives position-aware substitutions for leading openers, predicate definitions, and subsequent references.

The focused tests exercise the worked matrix example, `In`/`With`/`During`/`For` openers, case-insensitive and boundary behavior, predicate substitution, repeated mentions, punctuation escaping, question termination, and underscore avoidance. Recorded verification reports the focused test file, the broader web test set, and web typecheck passing; lint was attempted but could not resolve ESLint.

<details>
<summary>Issues (0)</summary>

No blocking concerns identified.

</details>

<details>
<summary>Details</summary>

### Position-aware substitution and question formation

The implementation first validates usable input and confirms a case-insensitive word-boundary match, preventing unrelated text from being changed. It explicitly recognizes the requested prepositional openers and converts the first opener to `Here,`; later opener-style mentions become `We also`, and remaining matches become `this process`. Predicate matches such as `is photosynthesis.` become `is known as what?`, including normalization of the consumed declarative period. A generic `What is this operation called?` suffix is added only when the final transformed text does not already end in a question mark.

### Locality, safety, and edge-case coverage

The only runtime behavior is deterministic string processing. The caller term is regex-escaped before interpolation, so punctuation and multi-word terms do not alter the pattern, and no network, LLM, external API, or heavy runtime dependency is introduced. The test file covers empty text, blank and absent terms, word-boundary non-matches, case-insensitive matching, existing question termination, punctuation in terms, and the prohibition on blank underscore masks.

### Verification status

The recorded verification reports 9 focused converter tests, 160 tests across the web test directory, and web typecheck passing. ESLint could not be run because it was not installed or resolvable in the web package; this leaves lint unverified but does not establish a blocking behavior defect.

</details>

<details>
<summary>File map</summary>

- `apps/web/lib/convertToQuestion.ts` — Adds the deterministic reference-substitution converter.
- `apps/web/lib/__tests__/convertToQuestion.test.ts` — Adds focused behavior and edge-case coverage.
- `.agents/tasks/convert-to-question/verification.md` — Records test, typecheck, and lint verification.

Full change: `git diff 0199906^ cf5fc01 -- apps/web/lib/convertToQuestion.ts apps/web/lib/__tests__/convertToQuestion.test.ts`.

</details>
