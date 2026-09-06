import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId, isValidAnonymousUserId } from '@/lib/anonymous';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody } from '@/lib/request-security';
import { createPairingTicket } from '@/lib/anonymous-pairing';

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const anonId = await getAnonymousUserId(req);
    if (!isValidAnonymousUserId(anonId)) {
      return NextResponse.json({ error: 'Valid authenticated session required' }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(req, 'anonymous-pair-create', anonId, 5, 60 * 60 * 1000);
    if (rateLimit) return rateLimit;

    let customPasscode: string | undefined;
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 0) {
      try {
        const body = await readJsonBody(req, 1024);
        customPasscode = boundedString(body.passcode, 'passcode', 6, false);
      } catch {
        // Body is optional; proceed with auto-generated passcode
      }
    }

    const { ticketId, passcode, fullCode, expiresAt } = await createPairingTicket(anonId, customPasscode);

    return NextResponse.json({
      success: true,
      ticketId,
      passcode,
      fullCode,
      code: fullCode, // backwards compatibility
      expiresAt,
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return NextResponse.json(
      { error: err.message || 'Unable to generate device pairing code' },
      { status }
    );
  }
}
