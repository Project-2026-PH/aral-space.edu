import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const ANON_COOKIE_NAME = 'quizmaster_anon_id';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const anonCookie = request.cookies.get(ANON_COOKIE_NAME);

  if (!anonCookie || !anonCookie.value) {
    // Generate persistent anonymous UUID
    const newAnonId = `anon_${crypto.randomUUID()}`;
    response.cookies.set({
      name: ANON_COOKIE_NAME,
      value: newAnonId,
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year persistence
      sameSite: 'lax',
      httpOnly: false, // accessible to client UI if needed
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except internal Next static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)',
  ],
};
