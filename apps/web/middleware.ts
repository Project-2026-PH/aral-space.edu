import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ANON_COOKIE_NAME,
  anonymousCookieOptions,
  createAnonymousSessionValue,
  verifyAnonymousSessionValue,
} from '@/lib/anonymous-token';

export async function middleware(request: NextRequest) {
  const currentValue = request.cookies.get(ANON_COOKIE_NAME)?.value;
  if (await verifyAnonymousSessionValue(currentValue)) {
    return NextResponse.next();
  }

  const newSessionValue = await createAnonymousSessionValue();
  request.cookies.set(ANON_COOKIE_NAME, newSessionValue);

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.cookies.set(
    ANON_COOKIE_NAME,
    newSessionValue,
    anonymousCookieOptions()
  );
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|health|api/health).*)',
  ],
};
