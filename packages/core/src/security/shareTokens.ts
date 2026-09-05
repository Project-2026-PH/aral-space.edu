const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

/** Generates an opaque token using the platform CSPRNG. */
export function generateSecureToken(length = 43): string {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('A cryptographically secure random generator is required');
  }

  cryptoApi.getRandomValues(bytes);
  let token = '';
  for (const byte of bytes) {
    token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  }
  return token;
}

export function isShareTokenValid(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function isShareTokenActive(
  isPublic: boolean | null | undefined,
  expiresAt?: string | null,
  revokedAt?: string | null
): boolean {
  if (isPublic === false || revokedAt) return false;
  if (!expiresAt) return true;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > Date.now();
}
