import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, HEAD } from '@/app/(app)/health/route';
import * as dbModule from '@/lib/db';

describe('Health endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 200 with healthy status and noStore cache header on successful ping', async () => {
    vi.spyOn(dbModule, 'pingDatabase').mockResolvedValue({
      ok: true,
      provider: 'neon',
      latencyMs: 15,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.database).toEqual({
      ok: true,
      provider: 'neon',
      latencyMs: 15,
    });
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.totalLatencyMs).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 503 with unhealthy status when database ping throws', async () => {
    vi.spyOn(dbModule, 'pingDatabase').mockRejectedValue(new Error('Connection timeout'));

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');

    const body = await response.json();
    expect(body.status).toBe('unhealthy');
    expect(body.error).toBe('Connection timeout');
  });

  it('HEAD request returns 200 with correct cache control', async () => {
    const response = await HEAD();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
  });
});
