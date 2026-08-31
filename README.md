# Quiz Creator Monorepo (MSRC + SOLID + SOC)

A production-grade, standalone Quiz Creation and Spaced-Repetition Mastery Monorepo extracted with pure separation of concerns.

## 🏛️ Monorepo Structure

```
quiz-creator/
├── packages/
│   ├── types/          # [Model Layer] Pure domain models, entities, DTOs, and contracts
│   ├── core/           # [Repository & Service Layers] Domain logic, AI generator, Spaced repetition engine
│   └── controllers/    # [Controller Layer] Transport handlers, validation, SSE orchestrator
├── apps/
│   └── web/            # [Presentation Layer] Next.js 15+ Web Application & Thin API Routes
└── sql/
    └── schema.sql      # Database schema for PostgreSQL / Supabase
```

## 🚀 Quick Start

1. Install dependencies from root:
```bash
pnpm install
```

2. Run development server:
```bash
pnpm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

3. Run production build check:
```bash
pnpm run build
```

## 💎 Features
- **AI Quiz Generation**: Streaming generation from lecture notes / handouts via Google Gemini (`@google/genai`).
- **Manual Question Studio**: Step-by-step question builder with validation and preview.
- **Mastery Runner**: 4 study modes (Multiple Choice, Interactive Flashcards, Direct Identification, Reverse Questioning).
- **Spaced Repetition & Batching**: 5-question focus batches, streak count locking, rest timers, progression scheduling.
- **Dual Storage Ready**: In-memory / local storage out-of-the-box + optional Supabase backend.
