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
The parser evaluates input text through a prioritized 4-tier pipeline:

```
Raw Text
   │
   ├── [1. Bulk Bulleted Terms] ── (• Term: Definition / Title Case Fallback)
   │
   ├── [2. Category Enumeration] ─ (Header + >= 2 bullets)
   │
   ├── [3. Single Pair] ────────── (TSV, Key-Value Delimiter, 2-line break)
   │
   └── [4. Inline Appositives] ─── ("Term, definition, and term, definition...")
```

#### Tier 1: Bulk Bulleted Terms (`extractBulkTerms`)
* **Regex Pattern:** `BULLET_PREFIX = /^(?:[•▪‣◦●○*]|[-–—]|\(?\d+[.)]|[oO][.)]?(?=\s)|[a-zA-Z][.)])\s+/`
* **Delimiter Pattern:** `TERM_DELIMITER = /^(.{2,80}?)(?:\s*:(?:\s+|$)|\s+[–—](?:\s+|$)|\s+-(?:\s+|$))([\s\S]*)$/`
* **Multiline Continuity:** Lines following a term line without a new bullet marker are treated as continuation of the preceding definition.
* **Title Case Fallback:** If a list uses bullets without delimiters (e.g. `• Business Relationship Management focuses on...`), once a delimited sibling confirms a list context, leading Title Case runs are extracted as terms.

#### Tier 2: Category Heading + Enumeration Blocks
* Detects category headers followed by two or more bulleted items.
* Emits `{ type: 'enumeration_blocks', blocks: [{ header, items: [...] }] }`.

#### Tier 3: Single Pair Extraction
* **TSV Support:** Splits tab characters `\t` (e.g., copied from Google Sheets / Excel).
* **Key-Value Delimiters:** Matches `:`, ` - `, ` – `, ` — `, or `=`.
* **Two-Line Heuristic:** If text is exactly two lines, line 1 is verified with `isLabelLike(line1)` (length $\le 80$, word count $\le 10$, no terminating periods or conjunctions) to prevent wrapped prose sentences from being mistaken for cards.

#### Tier 4: Inline Appositive Compound Definitions
* Detects complex grammatical structures like:
  > *"the marketplace, the physical world for people and things, and the marketspace, a virtual world of information."*
* Pairs alternating noun phrases and descriptive clauses with strict length and verb validation.

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
