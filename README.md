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
  - **Services**: `QuizGenerationService`, `MasteryEngineService`, `PdfExtractionService`, `QuizShuffleService`, `QuizTransformService`, `QuizRenamingService`.
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
  - **Mock Generator** (`mock`): Zero-credential fallback with pre-computed questions for local offline development.
  - **PDF Parser**: Extract lecture handouts and notes directly into questions.
  - **Real-Time Streaming**: Server-Sent Events (SSE) stream generation stage progress to the UI.
- **Mastery Engine & Spaced Repetition**:
  - 4 study modes: Multiple Choice, Flashcards, Direct Identification, and Reverse Questioning.
  - 5-question micro-batches with streak-based progress locking and rest timers.
  - Ebbinghaus forgetting curve scheduling: Initial -> 24h -> 3d -> 7d -> 14d reviews.
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
# AI Providers (At least one recommended; fallback mock used if omitted)
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

