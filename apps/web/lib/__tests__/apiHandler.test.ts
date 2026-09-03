import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { cachedJson, CACHE_PROFILES } from '../api-response';
import { createApiRoute } from '../api-handler';

vi.mock('@/lib/anonymous', () => ({
  getAnonymousUserId: vi.fn().mockResolvedValue('anon_test_user_123'),
  ANON_COOKIE_NAME: 'quizmaster_anon_id',
}));

describe('cachedJson', () => {
  it('attaches correct Cache-Control header for private profile', () => {
    const res = cachedJson({ data: 'hello' }, 'private');
    expect(res.headers.get('Cache-Control')).toBe(CACHE_PROFILES.private);
  });

  it('attaches correct Cache-Control header for public profile', () => {
    const res = cachedJson({ data: 'hello' }, 'public');
    expect(res.headers.get('Cache-Control')).toBe(CACHE_PROFILES.public);
  });

  it('attaches correct Cache-Control header for noStore profile', () => {
    const res = cachedJson({ data: 'hello' }, 'noStore');
    expect(res.headers.get('Cache-Control')).toBe(CACHE_PROFILES.noStore);
  });
});

describe('createApiRoute', () => {
  it('injects userId and caches response when cache option is specified', async () => {
    const handler = createApiRoute(async ({ userId }) => {
      return { user: userId, status: 'ok' };
    }, { cache: 'private' });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE_PROFILES.private);

    const body = await res.json();
    expect(body.user).toBe('anon_test_user_123');
    expect(body.status).toBe('ok');
  });

  it('resolves Promise params in Next.js 15 route style', async () => {
    const handler = createApiRoute<{ quizId: string }>(async ({ params }) => {
      return { id: params.quizId };
    });

    const req = new NextRequest('http://localhost:3000/api/quizzes/q123');
    const res = await handler(req, { params: Promise.resolve({ quizId: 'q123' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('q123');
  });

  it('skips auth when skipAuth is set', async () => {
    const handler = createApiRoute(async ({ userId }) => {
      return { userId };
    }, { skipAuth: true });

    const req = new NextRequest('http://localhost:3000/api/public/test');
    const res = await handler(req);
    const body = await res.json();

    expect(body.userId).toBe('');
  });

  it('preserves returned custom Response instances directly', async () => {
    const handler = createApiRoute(async () => {
      return NextResponse.json({ custom: true }, { status: 201 });
    });

    const req = new NextRequest('http://localhost:3000/api/custom');
    const res = await handler(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.custom).toBe(true);
  });

  it('handles not found errors by returning 404', async () => {
    const handler = createApiRoute(async () => {
      throw new Error('Study set not found');
    });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Study set not found');
  });

  it('handles general errors by returning 500', async () => {
    const handler = createApiRoute(async () => {
      throw new Error('Database connection failed');
    });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Database connection failed');
  });
});
