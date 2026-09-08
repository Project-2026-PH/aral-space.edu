# Quiz Creator Monorepo (MSRC + SOLID + SOC)

A production-grade, standalone Quiz Creation and Spaced-Repetition Mastery Monorepo built with Clean Architecture and strict Separation of Concerns (Model-Service-Repository-Controller pattern).

## 🏛️ Monorepo Architecture & Structure

```
quiz-creator/
├── packages/
│   ├── types/          # [Model Layer] Domain models, DTOs, enums, and repository contracts
│   ├── core/           # [Service & Repository Layers] Mastery engine, AI pipeline, PDF parser, LRU cache, DB repositories
│   └── controllers/    # [Controller Layer] Transport-agnostic business orchestration & SSE streaming
├── apps/
│   ├── web/            # [Presentation Layer] Next.js 15 App Router, Tailwind CSS, thin route handlers
│   └── mobile/         # [Presentation Layer] Expo (SDK 52) / React Native mobile application
└── sql/
    └── schema.sql      # PostgreSQL DDL schema (compatible with Supabase and Neon)
```

### Layer Breakdown

- **`packages/types`**: Pure TypeScript contracts and data structures (`Quiz`, `QuizQuestion`, `QuizSession`, `QuestionProgress`, `Batch`, `QuizMode`, DTOs). Zero dependencies.
- **`packages/core`**:
  - **Services**: `QuizGenerationService`, `MasteryEngineService`, `PdfExtractionService`, `QuizShuffleService`, `QuizTransformService`, `QuizRenamingService`, `NotesReviewerBuilder`.
  - **Repositories**: `NeonQuizRepository`, `NeonSessionRepository`, `SupabaseQuizRepository`, `SupabaseSessionRepository`, `LocalFirstQuizRepository`, `MemoryQuizRepository`.
  - **Caching**: `LRUCache`, `CachedQuizRepository` with TTL eviction.
  - **Factory**: `RepositoryFactory` for dynamic backend instantiation.
- **`packages/controllers`**: Transport-agnostic handlers (`QuizGenerationController`, `MasterySessionController`, `QuizCrudController`, `PdfParserController`).
- **`apps/web`**: Next.js 15+ frontend with Tailwind CSS, Server Actions / Route Handlers, anonymous session cookies, and SSE streaming.
- **`apps/mobile`**: Cross-platform Expo / React Native mobile app sharing `@quiz-creator/types` and `@quiz-creator/core`.

---

## 💎 Key Features

- **Multi-Pipeline AI Generation**:
  - **Two-Stage Pipeline** (`two_stage`): Gemini extracts and drafts questions; Groq (Llama-3.3-70b) reviews, verifies distractors, and ensures pedagogical quality.
  - **Gemini Direct** (`gemini_direct`): Fast single-stage generation using Google Gemini (`@google/genai`).
  - **Groq Direct** (`groq_direct`): High-speed single-stage generation using Groq API.
  - **Local Generator** (`local`): Zero-credential deterministic fallback that extracts source-grounded questions for offline use.
  - **Local Adaptive Authoring Preferences**: Learns bounded, content-free patterns from question creation and editing in browser storage, then safely adapts future generation after a confidence threshold.
  - **PDF Parser**: Extract lecture handouts and notes directly into questions.
  - **Real-Time Streaming**: Server-Sent Events (SSE) stream generation stage progress to the UI.
- **Mastery Engine & Spaced Repetition**:
  - 4 study modes: Multiple Choice, Flashcards, Direct Identification, and Reverse Questioning.
  - Continuous 7-item sliding-window mastery queue with streak-based progress locking and targeted struggle-pile review.
  - Ebbinghaus forgetting curve scheduling: Initial -> 24h -> 3d -> 7d -> 14d reviews.
- **Academic Term Categorization**:
  - **Grading Period Tagging**: Tag and organize quizzes by academic terms (e.g., *Prelim*, *Midterm*, *Finals*, *1st Grading*) directly below the subject in manual creation and via header badges in the quiz overview.
  - **Custom Term Creation**: Type any custom grading period on-the-fly; automatically added to user selection options.
  - **Multi-Level Library Filtering**: Filter library decks simultaneously by subject and academic term using interactive pill bars with deck count badges.
  - **Synchronized Cache Invalidation**: Tag-based Next.js cache revalidation and multi-backend invalidation (`quizzes:`, `library:`) ensure instant UI consistency across all CRUD updates.
- **Smart Note Import & Question Shaping**:
  - **Copy-Paste Import**: Paste notes directly from PDFs, slides, websites, or spreadsheets. Automatically separates terms and definitions from bulleted lists, TSV spreadsheets, and key-value pairs.
  - **Bold-Based Term Extraction**: Captures terms formatted in Markdown bold (`**Term**`) or rich HTML (`<b>`, `<strong>`, `font-weight: 700`) without requiring colons or dashes.
  - **Zero-Infra Mitigations**: Built-in deterministic heuristics filter out inline emphasis, editorial meta-labels (`Note:`, `Warning:`), whole-sentence bolding, and glue fragmented adjacent spans from Google Docs/Microsoft Word.
  - **Instant Study Modes**: Turns single definition-answer pairs into flashcards, 4-option multiple-choice quizzes, or reverse-prompt questions without extra typing.
  - **Natural True or False Cards**: Rewrites definitions into natural statements, swapping in concepts from other cards to generate realistic False questions (see [CLIPBOARD_PARSER_AND_TRANSFORMATION_FLOW.md](docs/CLIPBOARD_PARSER_AND_TRANSFORMATION_FLOW.md)).
- **Deterministic Notes Reviewers**:
  - **Notes Workspace Conversion**: `Save as reviewer` uses the pure `NotesReviewerBuilder` to turn structured notes into source-grounded reviewer questions without requiring an AI provider.
  - **Concept Cleanup**: Merges wrapped definition lines, ignores section headings, filters attribute labels from ordinary cards, and deduplicates expanded terms with acronym-only entries.
  - **Bounded Question Generation**: Produces at most one typed identification card and one multiple-choice reinforcement card per terminology concept, with timeline entries kept separate.
  - **Source Preservation**: Retains the normalized source definition as the answer explanation and correct explanation. Service Desk/Helpdesk attribute labels may be used in comparison questions instead of becoming standalone cards.
- **Flexible Multi-Backend Storage**:
  - **Neon Serverless Postgres**: Cloud PostgreSQL via `@neondatabase/serverless` with pooled HTTP queries and migration script.
  - **Supabase**: Direct Supabase client integration.
  - **Local-First & In-Memory**: Full functionality without external DB credentials using in-memory or localStorage fallback.
  - **Anonymous Sessions**: Out-of-the-box guest sessions with seamless progression persistence.
  - **LRU Caching**: Transparent in-memory cache layer (`CachedQuizRepository`) minimizing database round-trips on hot reads.

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: >= 18
- **pnpm**: >= 9 (`pnpm v11+` recommended)

### 2. Installation

Install all workspace dependencies from the monorepo root:

```bash
pnpm install
```

### 3. Environment Configuration

#### Option A: Infisical Secrets Management (Default)
Centralize and inject secrets dynamically across environments with KMS encryption:
```bash
infisical login
infisical init
pnpm dev
```
For detailed setup instructions, team onboarding, and Vercel KMS synchronization, see [INFISICAL.md](INFISICAL.md).

#### Option B: Manual `.env.local` (Offline Fallback)
Create `.env.local` in `apps/web` (or root `.env`):

```bash
# AI Providers (Optional; local deterministic generation is used if omitted)
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"

# Neon Database (Optional - falls back to Supabase or In-Memory)
DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Supabase (Optional fallback)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

To run with manual `.env.local` without Infisical:
```bash
pnpm dev:local
```

### 4. Running Applications

- **Web Application**:
  ```bash
  # Injected via Infisical (default):
  pnpm dev

  # Offline fallback using manual .env.local:
  pnpm dev:local
  ```
  Open [http://localhost:3000](http://localhost:3000).

- **Mobile Application**:
  ```bash
  pnpm mobile
  ```
  Launches Expo CLI to run on iOS Simulator, Android Emulator, or Expo Go.

---

## 🛠️ Monorepo Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts Next.js dev server with secrets injected via Infisical (default) |
| `pnpm dev:local` | Starts Next.js dev server using local `.env.local` (offline fallback) |
| `pnpm dev:infisical` | Alias for `pnpm dev` |
| `pnpm mobile` | Starts Expo dev server (`apps/mobile`) |
| `pnpm build` | Compiles all packages and builds web application |
| `pnpm test` | Runs unit test suite with Vitest across all packages |
| `pnpm test:infisical` | Runs Vitest suite with secrets injected via Infisical |
| `pnpm typecheck` | Typechecks all packages and apps with `tsc --noEmit` |
| `pnpm lint` | Runs linter across all workspaces |

---

## 🗄️ Database Setup & Migrations

To apply database schema to Neon or PostgreSQL:

1. Standard DDL schema is located in [sql/schema.sql](file:///c:/Users/User/IntelliJ/quiz-creator/sql/schema.sql).
2. For Neon migrations, you can run the programmatic migration runner:
   ```bash
   DATABASE_URL="your-connection-string" pnpm --filter @quiz-creator/core exec ts-node src/schema/migrate.ts
   ```

---

## 📚 Technical Documentation

- **[Clipboard Parser & Transformation Flow](docs/CLIPBOARD_PARSER_AND_TRANSFORMATION_FLOW.md)**: Comprehensive architectural flow and algorithms for clipboard parsing, Notes workspace reviewer generation, definition-to-question conversion, and True/False paraphrasing with the Term Swap Rule.
- **[Local Adaptive Authoring Preferences](docs/LOCAL_ADAPTIVE_AUTHORING_PREFERENCES.md)**: Aggregate local preference learning, event capture, confidence rules, request validation, privacy boundaries, and extension guidance.
- **[Infisical Secrets Setup](INFISICAL.md)**: Secrets management, KMS encryption, and environment variables.


## 📝 Notes Workspace Reviewer Generation

The Notes workspace stores rich-text notes locally and can convert the selected note into a reviewer through **Save as reviewer**. This path is separate from clipboard paste into the Manual Quiz Creator and uses the deterministic [`NotesReviewerBuilder`](packages/core/src/services/NotesReviewerBuilder.ts):

```text
Plain note text
   -> normalize and merge wrapped lines
   -> classify headings, terminology, comparison attributes, and timeline entries
   -> deduplicate expanded terms and acronym aliases
   -> emit typed identification and bounded reinforcement questions
   -> POST source-grounded questions to /api/quizzes
```

The builder is subject-agnostic for explicit structures such as `Term - Definition`, `Term: Definition`, and a term followed by a wrapped definition. It ignores section headings, keeps date-based entries in a separate timeline group, preserves source definitions in explanations, and emits no more than one identification plus one reinforcement question for each terminology concept. Attribute labels are not ordinary cards; the current comparison adapter uses Service Desk/Helpdesk attributes in comparison questions when both groups are present. Notes without recognizable structure are not saved as empty reviewers.

## 📤 Reviewer Export and Local Re-import Contract

Quiz detail pages (`/quizzes/[quizId]`) provide an **Export** menu beside **Share**:

- **JSON** downloads the stable `quiz-creator-reviewer` format (`version: 1`) with the quiz title, description, and question records.
- **CSV** downloads one row per question with explicit `question_text`, `answer_text`, `question_type`, `options`, `explanation`, and `source_pages` columns.
- **PDF** opens a print-ready answer-key document; choose **Save as PDF** in the browser print dialog.

These formats are intentionally source-grounded and deterministic. A future local clipboard importer can recognize the JSON/CSV field names or the PDF's repeated `Question` / `Answer` structure without sending the content to an AI provider. The export implementation is in [`apps/web/lib/quizExport.ts`](apps/web/lib/quizExport.ts), with the menu in [`apps/web/components/quiz/QuizExportMenu.tsx`](apps/web/components/quiz/QuizExportMenu.tsx).

## 🧩 Compound Handout Entries

College handouts often use one primary term followed by a paragraph containing important subordinate concepts. The local parser should preserve the primary entry and only create subordinate cards when the source provides explicit structure. For example, an `Unauthorized Association` entry can produce:

1. A parent identification card whose answer is **Unauthorized Association**.
2. An enumeration card asking for its two forms: **accidental association** and **malicious association**.
3. Optional child identification cards for **malicious association** and **accidental association**, using only the sentences that explicitly define each form.

The parser must not promote every technical noun in a paragraph to a new card. Child extraction should require evidence such as a phrase like `two forms`, a numbered/bulleted list, a repeated `Term: definition` pattern, or an explicit definition verb. This avoids noisy cards and keeps the parent-child relationship available for later review and export.


## 🏷️ Naming-Relation Handout Entries

Some handouts define a term indirectly with a naming sentence instead of a `Term: Definition` heading. For example:

```text
Users who regularly connect to multiple WLANs may connect to the rogue AP. Such APs mounted by attackers are called “honeypot” APs.
```

The local parser should interpret this as:

- **Answer term:** `honeypot APs`
- **Source definition:** rogue APs mounted by attackers that users may unknowingly connect to
- **Question:** `Users who connect to multiple WLANs may unknowingly connect to rogue APs mounted by attackers. What are such APs called?`

The answer must not appear in the question stem. Naming relations should be recognized only for explicit patterns such as `is called`, `are called`, `known as`, or `referred to as`. The parser should normalize soft-wrapped lines before applying the rule and should not promote the descriptive subject before `are called` to a term. See the detailed strategy in [CLIPBOARD_PARSER_AND_TRANSFORMATION_FLOW.md](docs/CLIPBOARD_PARSER_AND_TRANSFORMATION_FLOW.md).