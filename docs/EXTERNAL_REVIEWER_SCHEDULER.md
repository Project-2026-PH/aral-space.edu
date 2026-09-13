# External Reviewer Worker Scheduler

Vercel cron is intentionally not configured for this project. Use an external scheduler such as cron-job.org to invoke the existing reviewer-generation worker.

## Endpoint

```text
https://<your-production-domain>/api/internal/reviewer-generation/worker
```

The endpoint accepts `POST` and `GET`. Prefer `POST` with an empty JSON object as the request body. Each invocation claims and processes at most one queued reviewer-generation job; the database lease prevents the same job from being processed concurrently by multiple workers.

## cron-job.org setup

Create a job with:

- **URL:** your production endpoint above
- **Method:** `POST`
- **Schedule:** every minute, or a less frequent interval appropriate for your queue volume
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Body:** `{}`
- **Content-Type:** `application/json`

If the scheduler cannot send an `Authorization` header, use this alternative header instead:

```text
x-reviewer-worker-secret: <CRON_SECRET>
```

## Configure the secret

Create a strong random `CRON_SECRET` in the Vercel **Production** environment and configure the exact same value in the external scheduler. `REVIEWER_WORKER_SECRET` is also accepted by the endpoint, but use one secret consistently. Do not put the secret in the URL query string, because URLs can be logged by scheduler and proxy systems.

The worker returns `401` when the secret is missing or incorrect. A successful invocation returns `200` with `processed: true` when a job was handled or `processed: false` when the queue was empty.

## Manual smoke test

From PowerShell, replace the placeholders and run:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://<your-production-domain>/api/internal/reviewer-generation/worker" `
  -Headers @{ Authorization = "Bearer <CRON_SECRET>" } `
  -ContentType "application/json" `
  -Body '{}'
```

The application still requires its production database configuration (`DATABASE_URL` or `NEON_DATABASE_URL`) for durable queued jobs. Configure `OPENROUTER_API_KEY` as well when AI reviewer generation is enabled.
