export const ANON_COOKIE_NAME = 'quizmaster_anon_id';
export const ANON_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.ANON_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ANON_SESSION_SECRET must be configured with at least 32 characters');
  }
  return 'development-only-anonymous-session-secret-change-me';
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return crypto.subtle.verify('HMAC', key, decodeBase64Url(signature).buffer as ArrayBuffer, new TextEncoder().encode(payload));
}

export async function createAnonymousSessionValue(userId = `anon_${crypto.randomUUID()}`): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ANON_SESSION_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAnonymousSessionValue(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtText, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (!/^anon_[0-9a-f-]{36}$/i.test(userId) || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  try {
    return (await verifySignature(`${userId}.${expiresAtText}`, signature)) ? userId : null;
  } catch {
    return null;
  }
}

export function anonymousCookieOptions() {
  return {
    path: '/',
    maxAge: ANON_SESSION_TTL_SECONDS,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };
}

export function anonymousLabel(userId: string): string {
  return `Guest-${userId.replace(/^anon_/, '').slice(0, 6)}`;
}
