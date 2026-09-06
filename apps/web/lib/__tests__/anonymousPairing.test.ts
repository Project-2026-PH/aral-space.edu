import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPairingTicket,
  redeemPairingTicket,
  hashCode,
  normalizePairingCode,
  normalizeTicketId,
  parseFullCode,
  secureRandomInt,
  rollbackPairingTicket,
  _clearLocalTicketsForTest,
  _getLocalTicketForTest,
  PAIRING_TICKET_TTL_SECONDS,
  PAIRING_MAX_ATTEMPTS,
} from '../anonymous-pairing';

describe('Ephemeral Anonymous Session Pairing Service', () => {
  beforeEach(() => {
    process.env.PAIRING_DB_DISABLED = 'true'; // ensure pure local memory test execution
    _clearLocalTicketsForTest();
  });

  it('generates unbiased random integers within range without modulo bias', () => {
    for (let i = 0; i < 100; i++) {
      const val = secureRandomInt(900000);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(900000);
      expect(Number.isInteger(val)).toBe(true);
    }
    expect(() => secureRandomInt(0)).toThrow('maxExclusive must be between 1 and 2^32');
    expect(() => secureRandomInt(-5)).toThrow('maxExclusive must be between 1 and 2^32');
  });

  it('generates a valid 4-character Ticket ID and 6-digit numeric passcode with 10-minute TTL', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const beforeSec = Math.floor(Date.now() / 1000);
    const { ticketId, passcode, fullCode, expiresAt } = await createPairingTicket(userA);

    expect(ticketId).toMatch(/^[A-Za-z0-9]{4}$/);
    expect(passcode).toMatch(/^\d{6}$/);
    expect(fullCode).toBe(`${ticketId}-${passcode}`);
    expect(expiresAt).toBeGreaterThanOrEqual(beforeSec + PAIRING_TICKET_TTL_SECONDS - 2);
    expect(expiresAt).toBeLessThanOrEqual(beforeSec + PAIRING_TICKET_TTL_SECONDS + 2);
  });

  it('supports custom 6-digit passcodes', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const { passcode } = await createPairingTicket(userA, '654321');
    expect(passcode).toBe('654321');
  });

  it('rejects invalid custom passcodes including non-digits, spaces, or dashes', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    await expect(createPairingTicket(userA, '123')).rejects.toThrow('Passcode must be exactly 6 digits');
    await expect(createPairingTicket(userA, 'abc123456')).rejects.toThrow('Passcode must be exactly 6 digits');
    await expect(createPairingTicket(userA, '123 456')).rejects.toThrow('Passcode must be exactly 6 digits');
    await expect(createPairingTicket(userA, '1-2-3-4-5-6')).rejects.toThrow('Passcode must be exactly 6 digits');
  });

  it('explicitly normalizes pairing code by trimming whitespace only', () => {
    expect(normalizePairingCode('  123456  ')).toBe('123456');
    expect(() => normalizePairingCode('123 456')).toThrow('Passcode must be exactly 6 digits');
    expect(() => normalizePairingCode('abc123456')).toThrow('Passcode must be exactly 6 digits');
  });

  it('explicitly normalizes sync ID by trimming and uppercasing', () => {
    expect(normalizeTicketId('  a7b2  ')).toBe('A7B2');
    expect(() => normalizeTicketId('A7B')).toThrow('Invalid Sync ID format');
    expect(() => normalizeTicketId('A7B29')).toThrow('Invalid Sync ID format');
  });

  it('parses composite fullCode strictly', () => {
    expect(parseFullCode('A7B2-123456')).toEqual({ ticketId: 'A7B2', passcode: '123456' });
    expect(parseFullCode('  a7b2123456  ')).toEqual({ ticketId: 'A7B2', passcode: '123456' });
    expect(() => parseFullCode('invalid')).toThrow('Invalid code format');
  });

  it('hashes passcodes deterministically with SHA-256', async () => {
    const hash1 = await hashCode('123456');
    const hash2 = await hashCode('123456');
    const hash3 = await hashCode('654321');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });

  it('redeems valid ticket and switches to target session', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const { ticketId, passcode } = await createPairingTicket(userA);
    const result = await redeemPairingTicket({
      ticketId,
      passcode,
      currentAnonUserId: userB,
    });

    expect(result.targetAnonUserId).toBe(userA);
  });

  it('accepts combined fullCode string format (e.g. A7B2-123456)', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const { fullCode } = await createPairingTicket(userA);
    const result = await redeemPairingTicket({
      fullCode,
      currentAnonUserId: userB,
    });

    expect(result.targetAnonUserId).toBe(userA);
  });

  it('increments attempts on wrong passcode and reports remaining attempts', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const { ticketId } = await createPairingTicket(userA, '123456');

    // Attempt 1: wrong passcode
    await expect(
      redeemPairingTicket({ ticketId, passcode: '000000', currentAnonUserId: userB })
    ).rejects.toThrow('Incorrect passcode. 4 attempts remaining.');

    const ticketAfterAttempt1 = _getLocalTicketForTest(ticketId);
    expect(ticketAfterAttempt1?.attempts).toBe(1);

    // Attempt 2: wrong passcode
    await expect(
      redeemPairingTicket({ ticketId, passcode: '111111', currentAnonUserId: userB })
    ).rejects.toThrow('Incorrect passcode. 3 attempts remaining.');

    const ticketAfterAttempt2 = _getLocalTicketForTest(ticketId);
    expect(ticketAfterAttempt2?.attempts).toBe(2);
  });

  it('invalidates and deletes ticket after reaching maximum failed attempts (5)', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const { ticketId } = await createPairingTicket(userA, '123456');

    for (let i = 1; i < PAIRING_MAX_ATTEMPTS; i++) {
      await expect(
        redeemPairingTicket({ ticketId, passcode: '000000', currentAnonUserId: userB })
      ).rejects.toThrow();
    }

    // 5th attempt burns the ticket
    await expect(
      redeemPairingTicket({ ticketId, passcode: '000000', currentAnonUserId: userB })
    ).rejects.toThrow('Code invalidated due to too many failed attempts');

    // Ticket must be completely deleted
    expect(_getLocalTicketForTest(ticketId)).toBeUndefined();

    // Subsequent attempt reports not found / expired
    await expect(
      redeemPairingTicket({ ticketId, passcode: '123456', currentAnonUserId: userB })
    ).rejects.toThrow('Invalid or expired sync code');
  });

  it('allows the same ticket to sync multiple devices until it expires', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';
    const userC = 'anon_33333333-4444-5555-6666-777777777777';

    const { ticketId, passcode } = await createPairingTicket(userA);
    await expect(
      redeemPairingTicket({ ticketId, passcode, currentAnonUserId: userB })
    ).resolves.toEqual({ targetAnonUserId: userA });

    await expect(
      redeemPairingTicket({ ticketId, passcode, currentAnonUserId: userC })
    ).resolves.toEqual({ targetAnonUserId: userA });
  });

  it('rejects pairing when target session is same as current session', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const { ticketId, passcode } = await createPairingTicket(userA);

    await expect(
      redeemPairingTicket({ ticketId, passcode, currentAnonUserId: userA })
    ).rejects.toThrow('This device is already using this session');
  });

  it('rejects unauthenticated/malformed anonUserId during ticket creation', async () => {
    await expect(createPairingTicket('anon_victim')).rejects.toThrow(
      'Valid authenticated anonymous session required'
    );
    await expect(createPairingTicket('user_12345')).rejects.toThrow(
      'Valid authenticated anonymous session required'
    );
  });

  it('rejects unauthenticated/malformed currentAnonUserId during redemption', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const { ticketId, passcode } = await createPairingTicket(userA);

    await expect(
      redeemPairingTicket({ ticketId, passcode, currentAnonUserId: 'anon_victim' })
    ).rejects.toThrow('Valid authenticated anonymous session required on this device');
    await expect(
      redeemPairingTicket({ ticketId, passcode, currentAnonUserId: 'invalid' })
    ).rejects.toThrow('Valid authenticated anonymous session required on this device');
  });

  it('replaces previous ticket when creating a new ticket for same user', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const ticket1 = await createPairingTicket(userA, '111111');
    const ticket2 = await createPairingTicket(userA, '222222');

    // ticket1 should be invalidated/deleted
    await expect(
      redeemPairingTicket({ ticketId: ticket1.ticketId, passcode: ticket1.passcode, currentAnonUserId: userB })
    ).rejects.toThrow('Invalid or expired sync code');

    // ticket2 should succeed
    const res = await redeemPairingTicket({
      ticketId: ticket2.ticketId,
      passcode: ticket2.passcode,
      currentAnonUserId: userB,
    });
    expect(res.targetAnonUserId).toBe(userA);
  });

  it('rolls back consumed ticket so user can retry after downstream failure', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_22222222-3333-4444-5555-666666666666';

    const { ticketId, passcode } = await createPairingTicket(userA, '123456');

    // Redeem ticket
    await redeemPairingTicket({ ticketId, passcode, currentAnonUserId: userB });

    // Ticket is marked used
    expect(_getLocalTicketForTest(ticketId)?.usedAt).not.toBeNull();

    // Roll back ticket
    await rollbackPairingTicket(ticketId);

    // Ticket is now un-consumed and redeemable again
    expect(_getLocalTicketForTest(ticketId)?.usedAt).toBeNull();
    const res = await redeemPairingTicket({ ticketId, passcode, currentAnonUserId: userB });
    expect(res.targetAnonUserId).toBe(userA);
  });
});
