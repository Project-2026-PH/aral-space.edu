import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const localBuckets = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_WINDOW_MS = 60_000;
const MAX_LOCAL_BUCKETS = 10_000;

export class RequestSecurityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

export function assertPlainObject(value: unknown, name = 'body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestSecurityError(400, `${name} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function boundedString(value: unknown, field: string, maxLength: number, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new RequestSecurityError(400, `${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new RequestSecurityError(400, `${field} must be a string of at most ${maxLength} characters`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new RequestSecurityError(400, `${field} cannot be empty`);
  return trimmed;
}

export function boundedArray<T>(value: unknown, field: string, maxLength: number): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new RequestSecurityError(400, `${field} must contain at most ${maxLength} items`);
  }
  return value as T[];
}

export function boundedInteger(value: unknown, field: string, min: number, max: number, required = false): number | undefined {
  if (value === undefined || value === null) {
    if (required) throw new RequestSecurityError(400, `${field} is required`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new RequestSecurityError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function boundedBoolean(value: unknown, field: string, required = false): boolean | undefined {
  if (value === undefined || value === null) {
    if (required) throw new RequestSecurityError(400, `${field} is required`);
    return undefined;
  }
  if (typeof value !== 'boolean') throw new RequestSecurityError(400, `${field} must be a boolean`);
  return value;
}

export async function readJsonBody(req: NextRequest, maxBytes: number): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new RequestSecurityError(413, 'Request body is too large');

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new RequestSecurityError(413, 'Request body is too large');

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestSecurityError(400, 'Request body must be valid JSON');
  }
  return assertPlainObject(parsed);
}

function clientKey(req: NextRequest, principal?: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || req.headers.get('x-real-ip') || 'unknown';
  return `${principal || 'anonymous'}:${address}`;
}

async function consumeNeonLimit(key: string, limit: number, windowMs: number): Promise<boolean | null> {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!databaseUrl || process.env.RATE_LIMIT_DB_DISABLED === 'true') return null;

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      INSERT INTO security_rate_limits (bucket_key, window_started_at, request_count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (bucket_key) DO UPDATE
      SET
        request_count = CASE
          WHEN security_rate_limits.window_started_at <= now() - (${windowMs} * interval '1 millisecond') THEN 1
          ELSE security_rate_limits.request_count + 1
        END,
        window_started_at = CASE
          WHEN security_rate_limits.window_started_at <= now() - (${windowMs} * interval '1 millisecond') THEN now()
          ELSE security_rate_limits.window_started_at
        END
      RETURNING request_count
    `;
    return Number(rows[0]?.request_count || 0) <= limit;
  } catch (error) {
    console.warn('[RequestSecurity] Neon rate-limit backend unavailable; using local limiter.', error);
    return null;
  }
}

export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  principal?: string,
  limit = 30,
  windowMs = DEFAULT_WINDOW_MS
): Promise<NextResponse | null> {
  const key = `${scope}:${clientKey(req, principal)}`;
  const distributed = await consumeNeonLimit(key, limit, windowMs);
  if (distributed === true) return null;
  if (distributed === false) {
    return NextResponse.json({ error: 'Too many requests. Please retry later.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) }
    });
  }

  const now = Date.now();
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    if (localBuckets.size >= MAX_LOCAL_BUCKETS) {
      const oldest = localBuckets.keys().next().value;
      if (oldest) localBuckets.delete(oldest);
    }
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > limit) {
    return NextResponse.json({ error: 'Too many requests. Please retry later.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)) }
    });
  }
  return null;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new RequestSecurityError(504, message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function assertAllowedOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const expected = new URL(req.url).origin;
  if (origin !== expected) throw new RequestSecurityError(403, 'Cross-origin requests are not allowed');
}
