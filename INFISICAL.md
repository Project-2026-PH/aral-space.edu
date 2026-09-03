# Infisical Secrets Management & KMS Guide

This document details how to manage, inject, and synchronize secrets across local development, cloud deployments (Vercel), and automated workflows in the Quiz Creator monorepo using **[Infisical](https://infisical.com)** and Cloud Key Management Service (KMS).

---

## 🎯 Motivation

- **Eliminate `.env` drift**: Avoid out-of-sync local `.env` files across team members.
- **Prevent secret leaks**: Zero raw credentials stored in code, git commits, or shared chat channels.
- **Centralized access control**: Granular role-based access, audit logging, and secret rotation across `dev`, `staging`, and `prod` environments.
- **KMS-backed encryption**: Infisical encrypts secrets at rest and in transit using end-to-end encryption backed by KMS.
- **Automated Vercel synchronization**: Native two-way/one-way synchronization directly pushes environment variables to Vercel projects without manual copy-pasting.

---

## 📦 1. Infisical CLI Installation

Install the Infisical CLI for your platform:

### macOS
```bash
brew install infisical/get-cli/infisical
```

### Windows
Via Scoop:
```powershell
scoop bucket add infisical https://github.com/Infisical/scoop-infisical.git
scoop install infisical
```
Via Chocolatey:
```powershell
choco install infisical
```
Via npm (Global):
```powershell
npm install -g infisical
```

> **Windows PowerShell Note**: If PowerShell displays a `PSSecurityException` regarding script execution policies, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Or invoke via CMD: `cmd /c infisical <command>`.

### Linux
```bash
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install -y infisical
```

---

## 🔐 2. Developer Onboarding & Project Setup

### Step 1: Authenticate
Log in to your Infisical account (browser auth or machine identity):
```bash
infisical login
```

### Step 2: Link Monorepo Project
In the root directory of `quiz-creator`, link the workspace to the corresponding Infisical project:
```bash
infisical init
```
Select the **Quiz Creator** project when prompted. This creates or links `.infisical.json` in the root workspace.

---

## 📋 3. Required Secrets Schema

The monorepo expects the following secret keys managed within Infisical environments (`dev`, `staging`, `prod`):

| Secret Name | Required By | Description | Example / Format |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | `@quiz-creator/core`, `@quiz-creator/web` | Google Gemini API key for question generation | `AIzaSy...` |
| `GROQ_API_KEY` | `@quiz-creator/core`, `@quiz-creator/web` | Groq API key (Llama-3.3-70b reviewer & generator) | `gsk_...` |
| `DATABASE_URL` | `@quiz-creator/core`, `@quiz-creator/web` | Neon / PostgreSQL connection pooling string | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `NEXT_PUBLIC_SUPABASE_URL` | `@quiz-creator/web` | Supabase project URL (optional fallback storage) | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `@quiz-creator/web` | Supabase public anon key | `eyJhbGciOi...` |

---

## 💻 4. Running Locally with Infisical

### Direct Monorepo Task Runner (Default)
Run the web application with secrets injected directly into process memory (no disk write):
```bash
# Injected via Infisical (default):
pnpm dev

# Or using alias:
pnpm dev:infisical

# Offline mode using manual .env.local without Infisical:
pnpm dev:local
```

For test suite runs with Infisical secrets:
```bash
pnpm test:infisical
```

### Infisical CLI Wrappers
You can run any command wrapped in Infisical by specifying the environment:
```bash
# Development environment (default)
infisical run -- pnpm dev

# Staging or Production environment
infisical run --env=staging -- pnpm dev
infisical run --env=prod -- pnpm start
```

### Exporting Local `.env.local` (Optional Offline Mode)
If you need offline access or prefer physical `.env.local` files:
```bash
infisical export --env=dev > apps/web/.env.local
```
*(Ensure `.env.local` remains in `.gitignore` at all times).*

---

## ☁️ 5. Vercel KMS & Environment Syncing

Quiz Creator integrates Infisical directly with Vercel to manage preview and production deployments.

### How it Works:
1. **KMS Encryption**: Infisical manages encryption keys via Cloud KMS (AWS KMS, GCP Cloud KMS, or Infisical managed KMS).
2. **Native Vercel Integration**: Infisical pushes secrets directly to Vercel's encrypted Project Environment Variables API upon secret creation or update.

### Setup Instructions:
1. Navigate to the **Infisical Web Dashboard** > Project **Quiz Creator**.
2. Go to **Integrations** in the left sidebar.
3. Select **Vercel** and click **Connect**.
4. Authorize Infisical with your Vercel account and choose the **quiz-creator** project.
5. Configure environment mappings:
   - Infisical `dev` ➡️ Vercel **Preview** / **Development**
   - Infisical `prod` ➡️ Vercel **Production**
6. Select secret path: `/` (Root).
7. Enable **Initial Sync** to propagate existing secrets immediately.

Once synced, any secret added or updated in Infisical instantly propagates to Vercel without requiring manual Redeploy / ENV edits in Vercel.

---

## 🤖 6. CI/CD Pipeline Integration (Roadmap)

When automated GitHub Actions CI/CD workflows are enabled:
1. Create a **Machine Identity** in Infisical with read-only permissions for the `test` or `dev` environment.
2. Store the `INFISICAL_TOKEN` (or Client ID & Secret) in GitHub Repository Secrets.
3. In `.github/workflows/ci.yml`, use the official `infisical/secrets-action` to inject `DATABASE_URL`, `GROQ_API_KEY`, and `GEMINI_API_KEY` into testing and build steps.
