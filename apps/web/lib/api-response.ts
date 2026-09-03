import { NextResponse } from 'next/server';

export const CACHE_PROFILES = {
  private: 'private, max-age=10, stale-while-revalidate=60',
  public: 'public, max-age=30, stale-while-revalidate=120',
  noStore: 'no-store, no-cache, must-revalidate',
} as const;

export type CacheProfile = keyof typeof CACHE_PROFILES;

export function cachedJson<T>(
  data: T,
  profile: CacheProfile = 'private',
  init?: ResponseInit
): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': CACHE_PROFILES[profile],
      ...(init?.headers || {}),
    },
  });
}
