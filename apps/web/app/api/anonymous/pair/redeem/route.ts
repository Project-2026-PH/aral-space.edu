import { NextRequest, NextResponse } from 'next/server';
import {
  ANON_COOKIE_NAME,
  anonymousCookieOptions,
  anonymousLabel,
  createAnonymousSessionValue,
  getAnonymousUserId,
  isValidAnonymousUserId,
} from '@/lib/anonymous';
import {
  assertAllowedOrigin,
  boundedString,
  enforceRateLimit,
  readJsonBody,
} from '@/lib/request-security';
import { redeemPairingTicket, rollbackPairingTicket } from '@/lib/anonymous-pairing';
import { migrateAnonymousIdentity } from '@/lib/identity-migration';
import { revalidatePublicSubjectCaches, revalidateUserLists } from '@/lib/cached-queries';

export async function POST(req: NextRequest) {
  try {
    assertAllowedOrigin(req);
    const body = await readJsonBody(req, 1024);
    const ticketId = boundedString(body.ticketId, 'ticketId', 8, false);
    const passcode = boundedString(body.passcode, 'passcode', 8, false);
    const fullCode = boundedString(body.fullCode || body.code, 'fullCode', 20, false);
    const rawMode = boundedString(body.mode, 'mode', 16, false);
    const mode: 'replace' | 'merge' = rawMode === 'merge' ? 'merge' : 'replace';

    const currentAnonId = await getAnonymousUserId(req);
    if (!isValidAnonymousUserId(currentAnonId)) {
      return NextResponse.json({ error: 'Valid authenticated session required' }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(
      req,
      'anonymous-pair-redeem',
      currentAnonId,
      10,
      10 * 60 * 1000
    );
    if (rateLimit) return rateLimit;

    // 1. PairingTicketService: validate and atomically consume pairing ticket
    const { targetAnonUserId } = await redeemPairingTicket({
      ticketId,
      passcode,
      fullCode,
      currentAnonUserId: currentAnonId,
    });

    // 2. IdentityMigrationService: transactional atomic CTE merge
    if (mode === 'merge') {
      try {
        await migrateAnonymousIdentity(currentAnonId, targetAnonUserId);
      } catch (migrationErr) {
        // Roll back consumed ticket so user can safely retry without losing pairing state
        await rollbackPairingTicket(ticketId);
        throw migrationErr;
      }
    }

    // 3. CacheService: invalidate cached lists and public registries ONLY after DB transactions succeed
    revalidateUserLists(currentAnonId);
    revalidateUserLists(targetAnonUserId);
    revalidatePublicSubjectCaches();

    const response = NextResponse.json({
      success: true,
      label: anonymousLabel(targetAnonUserId),
      message: 'Device successfully synced',
    });

    response.cookies.set(
      ANON_COOKIE_NAME,
      await createAnonymousSessionValue(targetAnonUserId),
      anonymousCookieOptions()
    );

    return response;
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 400;
    return NextResponse.json(
      { error: err.message || 'Failed to sync device session' },
      { status }
    );
  }
}
