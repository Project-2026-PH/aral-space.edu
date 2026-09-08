# Clipboard Parser & Question Transformation Pipeline

This document explains how Quiz Creator automatically turns your raw lecture notes and copied text into interactive study questions.

---

## Key Features (The Simple Version)

### 1. Smart Copy-Paste (Clipboard Parser)
* **What it does:** You don't need to manually copy terms and definitions into separate input boxes. Just copy notes from your PDF, slide presentation, website, or Excel sheet, paste it into the quiz creator, and the system automatically figures out:
  * Which part is the **Term** (the vocabulary word or concept name).
  * Which part is the **Definition** (what it means or describes).
  * Whether you pasted a **single item** or a **whole list of bullet points**.
* **Real-world example:** If you copy `• Mitosis: The process of cell division resulting in two daughter cells`, the app instantly creates a card with `"The process of cell division resulting in two daughter cells"` as the prompt and `"Mitosis"` as the answer.

### 2. Instant Question Formatting
* **What it does:** Once a definition is pasted, the app turns it into whatever study format you want without needing extra typing:
  * **Identification / Flashcards:** Shows the definition, asks you to name the term.
  * **Multiple Choice:** Don't have time to write 3 wrong choices? The app automatically borrows plausible terms from your other cards in the same quiz to create a 4-choice quiz.
  * **Reverse Mode:** Asks you "Which term matches this definition?" to test your memory in both directions.

### 3. Smart True or False Generator
* **What it does:** When you switch a question to "True or False", the app doesn't leave raw notes as a question—it rewrites the definition and the term together into a smooth, natural-sounding sentence (just like a teacher would write on an exam).
* **How True vs. False works:**
  * **For a TRUE statement:** It combines the correct term with its actual definition.
  * **For a FALSE statement:** Instead of adding clumsy words like "not" or "does not", it takes a related term from another question in your deck and swaps it in.
* **Example in action:**
  * *Original Definition:* `"It involves envisioning physical operations more effectively with information..."`
  * *Original Term:* `Stage 1: New Processes`
  * *When TRUE:* `"Stage 1: New Processes involves envisioning physical operations more effectively with information..."` (Answer: **True**)
  * *When FALSE:* `"Stage 2: New Marketplace involves envisioning physical operations more effectively with information..."` (Answer: **False** — it actually describes Stage 1!)

---

## 1. High-Level Architectural Flow

```mermaid
flowchart TD
    A[Raw Clipboard Paste] --> B[parseSmartClipboard]
    B -->|Bulk Bulleted List| C1[Bulk Terms Array]
    B -->|Header + Bullets| C2[Enumeration Blocks]
    B -->|Key-Value / TSV / 2-Line / Appositives| C3[Single Pair / Inline Pairs]
    
    C1 --> D[ManualQuizCreator Ingestion]
    C2 --> D
    C3 --> D
    
    D --> E{Selected Card Type}
    E -->|Identification / QA| F1[question_text: Definition<br/>options: [Term]]
    E -->|Multiple Choice| F2[QuizTransformService.prepareQuestionsForOptions<br/>Pulls distractors from neighbor cards]
    E -->|True or False| F3[QuizTransformService.paraphraseToStatement<br/>Fused Declarative Assertion]
    
    F3 --> G{Target Truth}
    G -->|True| H1[Uses Correct Term T<br/>options: [True, False]<br/>correct_answer: 0]
    G -->|False| H2[Swaps with Distractor Term T_fake<br/>options: [True, False]<br/>correct_answer: 1]
```

---

## 2. Clipboard Parser (`clipboardParser.ts`)

Located in: [`apps/web/lib/clipboardParser.ts`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/lib/clipboardParser.ts)

### 2.1 Purpose
Enables zero-friction authoring by allowing students and instructors to copy notes, slides, PDFs, TSV spreadsheets, and textbook definitions directly into the quiz editor without manual copy-pasting across separate form fields.

### 2.2 Extraction Hierarchy
The parser evaluates input text (plain text and rich `text/html` from browser/word processors) through a prioritized pipeline:

```
Raw Text / HTML Clipboard
   │
   ├── [1. Numbered Q&A / Terms] ── (Numbered lines with Answer or continuation definitions)
   │
   ├── [2. Bold-Based Terms] ────── (**Term** Definition / <b>Term</b> Definition)
   │     ├── Rich HTML Normalization (glues fragmented spans, converts blocks to newlines)
   │     └── Heuristic Mitigations (inline emphasis, meta labels, whole-sentence guards)
   │
   ├── [3. Bulk Bulleted Terms] ─── (• Term: Definition / Title Case Fallback)
   │
   ├── [4. Category Enumeration] ── (Header + >= 2 bullets)
   │
   ├── [5. Single Pair] ─────────── (TSV, Key-Value Delimiter, 2-line break)
   │
   └── [6. Inline Appositives] ──── ("Term, definition, and term, definition...")
```

#### Tier 1: Numbered Question/Answers & Numbered Definitions
* Extracts `1. Question? Answer: ...` or numbered terms with following definition lines.

#### Tier 2: Bold-Based Term Separation (`extractBoldTerms` & `normalizeHtmlClipboard`)
* **Purpose:** Seamlessly captures glossary terms from slides, web lecture notes, PDFs, Google Docs, and Word where the author bolds key concepts instead of typing colons or dashes.
* **HTML Normalizer (`normalizeHtmlClipboard`):**
  * Extracts styling from `<b\b>`, `<strong\b>`, and `<span style="font-weight: bold|700">`.
  * **Fragmented Span Merging:** Google Docs and Microsoft Word frequently split bold words across adjacent spans (e.g. `<span style="font-weight:700">Mod</span><span style="font-weight:bold">eling</span>`). The normalizer automatically glues contiguous bold markers into `**Modeling**`.
  * Preserves list structure by converting `<li>` elements to bullet lines and `<p>`/`<div>`/`<br>` to newlines.
* **Zero-Infrastructure Deterministic Mitigations:**
  1. **Inline Emphasis Rejection:** Anchors pattern matching to the start of a line or bullet marker (`BOLD_LEAD_PATTERN = /^(?:(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[a-zA-Z][.)])\s+)?\*\*([^*]+)\*\*(.*)$/`). Mid-sentence bold words (e.g., `"The process is **strictly** sequential"`) are discarded as emphasis.
  2. **Editorial Meta-Label Blacklist:** Blocks common advisory and structural headings (`Note:`, `Warning:`, `Tip:`, `Caution:`, `Chapter \d+`, `Figure \d+`).
  3. **Whole-Sentence Bold Mitigation:** Rejects bold segments if they end with terminal punctuation (`/[.!?]$/`), contain finite predicate verbs (`FINITE_VERB`), exceed 8 words, or consume $> 45\%$ of the total text block length.
* **Delimiter Agnostic:** Works both with delimiters (`**Modeling** – deals with...`) and without delimiters (`**Polymorphism** allows objects to...`).

#### Tier 3: Bulk Bulleted Terms (`extractBulkTerms`)
* **Regex Pattern:** `BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[oO][.)]?(?=\s)|[a-zA-Z][.)])\s+/`
* **Delimiter Pattern:** `TERM_DELIMITER = /^(.{2,80}?)(?:\s*:(?:\s+|$)|\s+[–—](?:\s+|$)|\s+-(?:\s+|$))([\s\S]*)$/`
* **Multiline Continuity:** Lines following a term line without a new bullet marker are treated as continuation of the preceding definition.
* **Title Case Fallback:** If a list uses bullets without delimiters (e.g. `• Business Relationship Management focuses on...`), once a delimited sibling confirms a list context, leading Title Case runs are extracted as terms.

#### Tier 4: Category Heading + Enumeration Blocks
* Detects category headers followed by two or more bulleted items.
* Emits `{ type: 'enumeration_blocks', blocks: [{ header, items: [...] }] }`.

#### Tier 5: Single Pair Extraction
* **TSV Support:** Splits tab characters `\t` (e.g., copied from Google Sheets / Excel).
* **Key-Value Delimiters:** Matches `:`, ` - `, ` – `, ` — `, or `=`.
* **Two-Line Heuristic:** If text is exactly two lines, line 1 is verified with `isLabelLike(line1)` (length $\le 80$, word count $\le 10$, no terminating periods or conjunctions) to prevent wrapped prose sentences from being mistaken for cards.

#### Tier 6: Inline Appositive Compound Definitions
* Detects complex grammatical structures like:
  > *"the marketplace, the physical world for people and things, and the marketspace, a virtual world of information."*
* Pairs alternating noun phrases and descriptive clauses with strict length and verb validation.

### 2.3 Editor Synchronization & Prompt Paste Interception
When pasting into the question prompt editor ([`RichTextEditor.tsx`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/components/editor/RichTextEditor.tsx)):
* Programmatic paste interception in [`ManualQuizCreator.tsx`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/components/quiz/ManualQuizCreator.tsx) extracts term/definition pairs and sets `options: [term]` and `question_text: definition`.
* To prevent contentEditable focus desynchronization (where native paste is prevented and focus guards prevent external props from syncing to innerHTML), the editor compares sanitized text representations. If an external programmatic change occurs while focused, the editor automatically writes the normalized content into the DOM and places the selection at the end.

### 2.4 Notes Workspace Reviewer Builder

The Notes workspace has a separate deterministic path from clipboard paste. When the user selects **Save as reviewer**, `apps/web/components/notes/NotesClient.tsx` converts the note's rich text to plain text and passes it to [`NotesReviewerBuilder`](../packages/core/src/services/NotesReviewerBuilder.ts).

```text
Plain note text
   -> normalize and merge wrapped lines
   -> classify terminology, headings, comparison attributes, and timeline entries
   -> deduplicate expanded terms and acronym aliases
   -> build source-grounded reviewer questions
   -> POST typed_answer / multiple_choice records to /api/quizzes
```

The builder is generic for explicit term-definition structures such as:

```text
Term - Definition
Term: Definition
Term
Wrapped definition on the following lines
```

Its deterministic rules are:

1. **Heading filtering:** Section headings such as `Benefits`, `History`, `Requirements`, `Software`, `Service Desk`, and `Helpdesk` are context markers, not terminology cards.
2. **Wrapped definitions:** Continuation lines are joined into one source definition until the next recognized entry or section.
3. **Acronym deduplication:** An expanded term such as `Information Technology Service Management (ITSM)` and an acronym-only entry such as `ITSM` are represented as one concept.
4. **Attribute handling:** Short labels such as `Business-centric`, `Proactive Service`, or `Task-Oriented` are not emitted as ordinary cards. Service Desk/Helpdesk attributes can be used in comparison questions when both groups are present.
5. **Bounded repetition:** Each terminology concept receives at most one typed identification card and one multiple-choice reinforcement card. Reinforcement is emitted only when enough distinct concepts exist to provide three distractors.
6. **Timeline separation:** Date entries such as `1989–1996:` and `2019:` become timeline questions appended after terminology and comparison questions.
7. **Source preservation:** The normalized source wording is retained in `answer_text`, `explanation`, and `correct_explanation`; the builder does not paraphrase definitions.
8. **Safety bound:** The builder emits no more than 100 API question records. Notes with no recognizable structure are not saved as empty reviewers.

This builder does not require Gemini, Groq, or another AI provider. It is implemented as a pure core service and is covered by deterministic unit tests in `packages/core/src/services/__tests__/NotesReviewerBuilder.test.ts`.

---

## 3. Changing Pasted Definitions into Question Formats

Located in:
- [`apps/web/components/quiz/ManualQuizCreator.tsx`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/components/quiz/ManualQuizCreator.tsx)
- [`packages/core/src/services/QuizTransformService.ts`](file:///c:/Users/User/IntelliJ/quiz-creator/packages/core/src/services/QuizTransformService.ts)

### 3.1 Initial Ingestion into Identification / Direct QA
When a single pair or bulk terms are parsed:
```typescript
{
  type: 'identification',
  question_text: parsed.definition,
  options: [parsed.term],
  correct_answer: 0,
  explanation: ''
}
```
* **Question Prompt:** The definition clause.
* **Target Answer:** The term label.

### 3.2 Dynamic Multiple Choice Synthesis (`prepareQuestionsForOptions`)
Sparse 1-option identification cards can be converted on-the-fly into 4-choice multiple-choice questions without AI or database latency:
1. Retrieves target term $T_{correct}$ from the current card.
2. Scans forward (`index + 1` to `N - 1`) and backward (`index - 1` down to `0`) across the deck to collect distinct answer terms from other cards.
3. Fills up to 4 distinct options with $T_{correct}$ deterministically positioned.

### 3.3 Reverse Concept Questioning (`generateReverseQuestions`)
Transforms term-identification pairs into reverse recognition cards:
* **Prompt:** ``Which term matches: "${question_text}"?``
* **Options:** Correct term + distractor terms.

---

## 4. Changing Definitions into True or False Questions

Located in: [`packages/core/src/services/QuizTransformService.ts`](file:///c:/Users/User/IntelliJ/quiz-creator/packages/core/src/services/QuizTransformService.ts)

When the user selects **True or False** in the card editor, or when generating True/False study sessions, the definition must be transformed from a passive definition into an active declarative statement.

### 4.1 Syntactic Paraphrasing Algorithm (`paraphraseToStatement`)

The algorithm strips quotation marks and matches opening definition patterns to inject the term as the sentence subject:

| Input Pattern | Match Regex | Output Transformation |
| :--- | :--- | :--- |
| `"It involves..."` | `/^It\s+involves\b/i` | `${term} involves...` |
| `"It is defined as..."` | `/^It\s+is\s+defined\s+as\b/i` | `${term} is defined as...` |
| `"It refers to..."` | `/^It\s+refers\s+to\b/i` | `${term} refers to...` |
| `"It describes..."` | `/^It\s+describes\b/i` | `${term} describes...` |
| `"It is the process of..."` | `/^It\s+is\s+the\s+process\s+of\b/i` | `${term} is the process of...` |
| `"Refers to..."` | `/^Refers\s+to\b/i` | `${term} refers to...` |
| `"The process of..."` | `/^The\s+process\s+of\b/i` | `${term} is the process of...` |
| `"Is an essential step..."` | `/^Is\s+an?\b/i` | `${term} is an...` |
| `"Envisioning..."` (Gerund) | `/^[A-Z][a-z]+ing\b/` | `${term} involves envisioning...` |
| `"What is [Concept]?"` | `/^What\s+is\b/i` | `${term} is [Concept].` |
| Universal Fallback | *No pattern match* | `${term} is defined as: ${text}` |

### 4.2 Truth Assignment & The Term Swap Rule (`convertToTrueFalse`)

Rather than relying on clunky negative particles (`"...does not involve..."`), False questions use the **Term Swap Rule** to maximize pedagogical discrimination:

1. **For a TRUE Question:**
   - Subject Term = $T_{correct}$
   - Statement = `paraphraseToStatement(definition, T_correct)`
   - `options = ['True', 'False']`
   - `correct_answer = 0` (`True`)
   - `explanation = "True. \"${T_correct}\" is accurately described by this statement."`

2. **For a FALSE Question:**
   - Subject Term = $T_{distractor}$ (selected from neighboring deck cards, e.g. `Stage 2:New Marketplace`)
   - Statement = `paraphraseToStatement(definition, T_distractor)`
   - `options = ['True', 'False']`
   - `correct_answer = 1` (`False`)
   - `explanation = "False. This statement actually describes \"${T_correct}\", not \"${T_distractor}\"."`

### 4.3 Balanced Deck Generation (`generateTrueFalseQuestions`)
Iterates through all questions in a deck, allocating balanced True/False targets (alternating even/odd by default), pulling distinct distractor terms from sibling cards, and returning verified True/False `QuizQuestion` models.

---

## 5. Concrete End-to-End Walkthrough

### Example Input
* **Pasted Text:**
  ```text
  Stage 1:New Processes: It involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully.
  ```

### Step 1: Clipboard Parser Execution
* Matched Rule: `Tier 3b (Key-Value Delimiter ':')`
* **Extracted Term:** `"Stage 1:New Processes"`
* **Extracted Definition:** `"It involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully."`

### Step 2: Question Format Ingestion
Card created in `ManualQuizCreator`:
* **Type:** `identification`
* **Question Prompt:** *"It involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully."*
* **Option[0] (Answer):** *"Stage 1:New Processes"*

### Step 3: Switching to "True or False"
When author selects **True or False** (or when running True/False practice mode):

#### Scenario A: True Statement
* **Generated Statement:**
  > *"**Stage 1:New Processes** involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully."*
* **Options:** `['True', 'False']`
* **Correct Answer:** `0` (`True`)
* **Feedback:** *"True. \"Stage 1:New Processes\" is accurately described by this statement."*

#### Scenario B: False Statement (Term Swap with Sibling Card)
* **Distractor Candidate:** `"Stage 2:New Marketplace"`
* **Generated Statement:**
  > *"**Stage 2:New Marketplace** involves envisioning physical operations more effectively with information such as PLDT employing “paperless billing” to their customers and moving the process from a manual paper-based filing system to a central computerized database. It is an essential step to utilize the benefits of the marketspace fully."*
* **Options:** `['True', 'False']`
* **Correct Answer:** `1` (`False`)
* **Feedback:** *"False. This statement actually describes \"Stage 1:New Processes\", not \"Stage 2:New Marketplace\"."*


## 6. Reviewer Export Contract

The quiz detail page exposes an **Export** menu immediately beside **Share**. Export behavior is implemented in [`apps/web/lib/quizExport.ts`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/lib/quizExport.ts) and [`apps/web/components/quiz/QuizExportMenu.tsx`](file:///c:/Users/User/IntelliJ/quiz-creator/apps/web/components/quiz/QuizExportMenu.tsx).

### 6.1 JSON

JSON uses a versioned, source-grounded document shape designed for deterministic local re-import:

```json
{
  "format": "quiz-creator-reviewer",
  "version": 1,
  "title": "Wireless Networks",
  "description": "",
  "questions": [
    {
      "question_text": "...",
      "answer_text": "Unauthorized Association",
      "question_type": "typed_answer",
      "options": ["Unauthorized Association"],
      "explanation": "",
      "source_pages": []
    }
  ]
}
```

### 6.2 CSV

CSV contains one question per row with these headers:

```text
question_text,answer_text,question_type,options,explanation,source_pages
```

`options` is JSON-encoded inside the CSV cell and `source_pages` is pipe-delimited. Fields are quoted and escaped when they contain commas, quotes, or line breaks.

### 6.3 PDF

PDF export is browser-based: the app opens a print-ready answer-key document containing the title, each question, options, answer, and explanation. The user selects **Save as PDF** in the browser print dialog. This avoids adding a client-side PDF dependency while keeping the text selectable for a future local parser.

## 7. Compound Handout Entries and Nested Concepts

A handout block may have one primary term but several important subordinate concepts. The parser should model this as a parent concept with explicitly detected children, rather than splitting every technical phrase into a separate card.

### 7.1 Detection Rules

Nested extraction should be attempted only when the source provides strong structural evidence:

1. A primary `Term: definition` or `Term — definition` heading has already been detected.
2. The definition contains an explicit cardinality or grouping cue, such as `two forms`, `three types`, `categories include`, or `classified as`.
3. The subordinate names are repeated or introduced using recognizable labels, such as `accidental association involves...` and `malicious association...`, a numbered list, bullets, or separate `Term: definition` lines.
4. A child definition must contain meaningful descriptive text and must be tied to the parent block.

Do **not** create child cards merely because a paragraph contains capitalized words or technical nouns. This would turn incidental references such as `soft APs`, `Trojans`, and `wired network` into noisy false concepts.

### 7.2 Proposed Internal Representation

The existing `single_pair` and `bulk_terms` results remain backward-compatible. A future compound result can add optional metadata rather than changing the meaning of existing fields:

```typescript
interface CompoundConcept {
  term: string;
  definition: string;
  children: Array<{
    term: string;
    definition: string;
    relation: 'form' | 'type' | 'component' | 'step';
    confidence: number;
  }>;
}
```

The parent remains the source of truth. Child cards should carry `parentTerm` / `relation` metadata when persisted so the UI can present them as a group and exports can preserve the hierarchy.

### 7.3 Unauthorized Association Example

The current parser sees the opening `Unauthorized Association:` delimiter and produces one parent pair. The full wrapped paragraph remains the definition, including the phrases `accidental association` and `malicious association`.

The intended future output is:

**Parent identification card**

- **Prompt:** `A major threat to wireless networks involving two forms that can create unauthorized access to an enterprise network. What is this threat?`
- **Answer:** `Unauthorized Association`

**Enumeration card**

- **Prompt:** `What are the two forms of Unauthorized Association?`
- **Answer:** `accidental association; malicious association`

**Child identification card: malicious association**

- **Prompt:** `An attacker uses soft APs instead of corporate APs, infects a victim machine, and activates the soft APs to allow an unauthorized connection to the enterprise network. What form of unauthorized association is this?`
- **Answer:** `malicious association`

**Child identification card: accidental association**

- **Prompt:** `A device connects to a target network's access point from a neighboring organization's overlapping network without the victim's knowledge. What form of unauthorized association is this?`
- **Answer:** `accidental association`

The local algorithm should first create the parent card, then create the enumeration card, and finally create child cards only when the child-specific definition can be isolated with sufficient confidence. If child boundaries are ambiguous, it is safer to retain the terms inside the parent definition and create only the parent card than to invent unsupported questions.

### 7.4 Recommended Processing Pipeline

```text
Raw handout block
  -> detect primary term and full definition
  -> normalize wrapped lines
  -> detect explicit group cue (e.g. "two forms")
  -> locate subordinate labels and their sentence spans
  -> score child extraction confidence
  -> emit parent card
  -> emit enumeration card when all child labels are known
  -> emit child cards only above the confidence threshold
```

This preserves the deterministic, offline behavior of the local generator while supporting the richer structure commonly found in Philippine college handouts.


## 8. Naming-Relation Definitions

Not every handout entry has a visible `Term: Definition` heading. A common academic format describes a phenomenon first and then names it with a sentence such as:

```text
Users who regularly connect to multiple WLANs may connect to the rogue AP. Such APs mounted by attackers are called “honeypot” APs.
```

### 8.1 Correct Interpretation

The answer is the phrase after the naming relation:

```text
Term: honeypot APs
Definition: rogue APs mounted by attackers that users may unknowingly connect to
Relation: called
```

A suitable multiple-choice question from the local generator is:

```text
Users who connect to multiple WLANs may unknowingly connect to rogue APs mounted by attackers. What are such APs called?
```

The correct option is `honeypot APs`. The answer term must be removed from the question stem, while the source wording remains the basis for the explanation and `correct_explanation`.

### 8.2 Detection Rule

This should be a dedicated naming-relation extractor evaluated before the generic `is / are` sentence splitter:

```text
[descriptive subject] is|are called [quoted or unquoted term]
[descriptive subject] is|are known as [term]
[descriptive subject] is|are referred to as [term]
```

The extractor should:

1. Join soft-wrapped lines into normalized sentence text.
2. Match the relation phrase (`called`, `known as`, or `referred to as`).
3. Treat the phrase after the relation as the answer term.
4. Use the descriptive subject and nearby context as the definition.
5. Remove quotes and trailing sentence punctuation from the answer term.
6. Redact the answer term from the generated question.
7. Require a short, label-shaped answer (for example, `honeypot APs`) and meaningful descriptive context.

The generic sentence splitter must not process `Such APs mounted by attackers are called...` first. If it does, it may incorrectly infer `Such APs mounted by attackers` as the term and leave `honeypot APs` in the definition.

### 8.3 Conservative Fallback

If the relation phrase is ambiguous, the answer contains a full sentence, or no useful context can be isolated, keep the source as an ordinary definition block instead of guessing. The parser should never create cards for incidental nouns such as `WLANs`, `rogue AP`, or `attackers` unless the source explicitly names them through a supported relation.

### 8.4 Current Implementation Status

The current `LocalQuizGenerator` supports delimiter, sentence, wrapped, compound-form, and naming-relation concepts. Naming relations are extracted before generic sentence definitions so phrases such as `are called “honeypot” APs` produce `honeypot APs` as the answer rather than promoting the descriptive subject to a term. The Notes workspace uses the separate `NotesReviewerBuilder`. It currently prioritizes explicit delimited pairs and standalone term-plus-wrapped-definition entries, while also handling headings, acronym deduplication, comparison attributes, and timeline entries. Naming-relation extraction remains part of the local handout-generation path and is not currently emitted by the Notes workspace builder. Ambiguous or unsupported note prose is conservatively ignored instead of being promoted to a card.