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

    // 1. PairingTicketService: validate the short-lived ticket without consuming it.
    // The ticket owner is the source identity whose data will be merged or used.
    const { targetAnonUserId: sourceAnonUserId } = await redeemPairingTicket({
      ticketId,
      passcode,
      fullCode,
      currentAnonUserId: currentAnonId,
    });

    // 2. IdentityMigrationService: merge source-owned data into this device's identity.
    // Merge must preserve the redeeming device's guest ID; replace intentionally switches
    // this device to the source identity below.
    const resultingAnonUserId = mode === 'merge' ? currentAnonId : sourceAnonUserId;
    if (mode === 'merge') {
      try {
        await migrateAnonymousIdentity(sourceAnonUserId, currentAnonId);
      } catch (migrationErr) {
        // Roll back consumed ticket so user can safely retry without losing pairing state
        await rollbackPairingTicket(ticketId);
        throw migrationErr;
      }
    }

    // 3. CacheService: invalidate cached lists and public registries ONLY after DB transactions succeed
    revalidateUserLists(currentAnonId);
    revalidateUserLists(sourceAnonUserId);
    revalidatePublicSubjectCaches();

    const response = NextResponse.json({
      success: true,
      label: anonymousLabel(resultingAnonUserId),
      message: mode === 'merge'
        ? 'Quizzes merged; this guest session remains active'
        : 'Device successfully connected to the primary session',
    });

    response.cookies.set(
      ANON_COOKIE_NAME,
      await createAnonymousSessionValue(resultingAnonUserId),
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
