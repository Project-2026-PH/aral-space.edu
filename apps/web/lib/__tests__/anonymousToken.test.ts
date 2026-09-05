import { describe, it, expect } from 'vitest';
import {
  createAnonymousSessionValue,
  verifyAnonymousSessionValue,
  anonymousCookieOptions,
  anonymousLabel,
  ANON_COOKIE_NAME,
} from '../anonymous-token';

describe('Edge Anonymous Token Web Crypto', () => {
  it('signs and verifies a valid anonymous session token', async () => {
    const userId = 'anon_11111111-2222-3333-4444-555555555555';
    const token = await createAnonymousSessionValue(userId);

    expect(token).toBeDefined();
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(userId);

    const verifiedId = await verifyAnonymousSessionValue(token);
    expect(verifiedId).toBe(userId);
  });

  it('rejects tampered signature', async () => {
    const userId = 'anon_11111111-2222-3333-4444-555555555555';
    const token = await createAnonymousSessionValue(userId);
    const [id, exp, sig] = token.split('.');

    // Tamper with signature
    const tamperedSig = sig.slice(0, -2) + (sig.endsWith('a') ? 'b' : 'a');
    const result = await verifyAnonymousSessionValue(`${id}.${exp}.${tamperedSig}`);
    expect(result).toBeNull();
  });

  it('rejects tampered userId with valid signature from another user', async () => {
    const userA = 'anon_11111111-2222-3333-4444-555555555555';
    const userB = 'anon_99999999-8888-7777-6666-555555555555';
    const tokenA = await createAnonymousSessionValue(userA);
    const [, exp, sig] = tokenA.split('.');

    // Attempt to forge token for User B using User A's signature
    const forgedToken = `${userB}.${exp}.${sig}`;
    const result = await verifyAnonymousSessionValue(forgedToken);
    expect(result).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const userId = 'anon_11111111-2222-3333-4444-555555555555';
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const forgedToken = `${userId}.${pastTimestamp}.fakesig`;

    const result = await verifyAnonymousSessionValue(forgedToken);
    expect(result).toBeNull();
  });

  it('returns secure cookie options', () => {
    const options = anonymousCookieOptions();
    expect(options.path).toBe('/');
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it('generates consistent guest label', () => {
    const label = anonymousLabel('anon_abcdef12-3456-7890-abcd-ef1234567890');
    expect(label).toBe('Guest-abcdef');
  });
});
