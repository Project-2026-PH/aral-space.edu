import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import {
  ANON_COOKIE_NAME,
  createAnonymousSessionValue,
  verifyAnonymousSessionValue,
  anonymousCookieOptions,
} from './anonymous-token';

export * from './anonymous-token';

export async function getAnonymousUserId(req?: NextRequest): Promise<string> {
  const raw = req?.cookies.get(ANON_COOKIE_NAME)?.value;
  const verifiedRequestId = await verifyAnonymousSessionValue(raw);
  if (verifiedRequestId) return verifiedRequestId;

  try {
    const cookieStore = await cookies();
    const verifiedStoreId = await verifyAnonymousSessionValue(cookieStore.get(ANON_COOKIE_NAME)?.value);
    if (verifiedStoreId) return verifiedStoreId;

    const userId = `anon_${crypto.randomUUID()}`;
    cookieStore.set(ANON_COOKIE_NAME, await createAnonymousSessionValue(userId), anonymousCookieOptions());
    return userId;
  } catch (error) {
    // Middleware and API routes establish the cookie before this helper runs.
    // Never return a new random ID here: it would make persisted data belong to
    // an identity that is different from the browser's session.
    throw error instanceof Error ? error : new Error('Unable to establish anonymous session');
  }
}
