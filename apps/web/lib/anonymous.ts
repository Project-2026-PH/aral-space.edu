import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const ANON_COOKIE_NAME = 'quizmaster_anon_id';

/**
 * Retrieves or generates an anonymous user ID in Next.js Server Components / Route Handlers.
 */
export async function getAnonymousUserId(req?: NextRequest): Promise<string> {
  if (req) {
    const fromReq = req.cookies.get(ANON_COOKIE_NAME)?.value;
    if (fromReq) return fromReq;
  }

  try {
    const cookieStore = await cookies();
    const fromStore = cookieStore.get(ANON_COOKIE_NAME)?.value;
    if (fromStore) return fromStore;

    const fallbackId = `anon_${crypto.randomUUID()}`;
    try {
      cookieStore.set(ANON_COOKIE_NAME, fallbackId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        httpOnly: false,
      });
    } catch {
    }
    return fallbackId;
  } catch {
    return `anon_${crypto.randomUUID()}`;
  }
}
