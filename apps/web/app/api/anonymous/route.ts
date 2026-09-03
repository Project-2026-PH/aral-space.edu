import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId, ANON_COOKIE_NAME } from '@/lib/anonymous';

export async function GET(req: NextRequest) {
  try {
    const anonId = await getAnonymousUserId(req);
    const response = NextResponse.json({
      anonId,
      isAnonymous: true,
      label: `Guest-${anonId.replace('anon_', '').slice(0, 6)}`
    });

    // Refresh cookie
    response.cookies.set({
      name: ANON_COOKIE_NAME,
      value: anonId,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'reset') {
      const newAnonId = `anon_${crypto.randomUUID()}`;
      const response = NextResponse.json({
        success: true,
        anonId: newAnonId,
        label: `Guest-${newAnonId.replace('anon_', '').slice(0, 6)}`,
        message: 'Anonymous session reset successfully'
      });

      response.cookies.set({
        name: ANON_COOKIE_NAME,
        value: newAnonId,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        httpOnly: false,
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
