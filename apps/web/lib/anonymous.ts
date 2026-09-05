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
  } catch {
    return `anon_${crypto.randomUUID()}`;
  }
}
