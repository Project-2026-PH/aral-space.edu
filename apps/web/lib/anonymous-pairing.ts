import { neon } from '@neondatabase/serverless';
import { isValidAnonymousUserId } from './anonymous-token';

export const PAIRING_TICKET_TTL_SECONDS = 10 * 60; // 10 minutes
export const PAIRING_MAX_ATTEMPTS = 5;

export interface PairingTicket {
  ticketId: string;
  anonUserId: string;
  passcodeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number; // unix timestamp in seconds
  usedAt: number | null;
}

// In-memory fallback store for local development and unit tests
const localTickets = new Map<string, PairingTicket>();

export function _clearLocalTicketsForTest(): void {
  localTickets.clear();
}

export function _getLocalTicketForTest(ticketId: string): PairingTicket | undefined {
  return localTickets.get(ticketId.toUpperCase());
}

export function normalizePairingCode(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Passcode must be a string');
  }
  const trimmed = input.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error('Passcode must be exactly 6 digits');
  }
  return trimmed;
}

export function normalizeTicketId(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Sync ID must be a string');
  }
  const trimmed = input.trim().toUpperCase();
  if (!/^[A-Za-z0-9]{4}$/.test(trimmed)) {
    throw new Error('Invalid Sync ID format. Expected 4 characters.');
  }
  return trimmed;
}

export function parseFullCode(input: string): { ticketId: string; passcode: string } {
  if (typeof input !== 'string') {
    throw new Error('Full code must be a string');
  }
  const trimmed = input.trim();
  const match = trimmed.match(/^([A-Za-z0-9]{4})-?(\d{6})$/);
  if (!match) {
    throw new Error('Invalid code format. Expected 4-character Sync ID and 6-digit passcode.');
  }
  return {
    ticketId: normalizeTicketId(match[1]),
    passcode: normalizePairingCode(match[2]),
  };
}

export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an unbiased cryptographically secure integer in [0, maxExclusive).
 * Uses rejection sampling to completely eliminate modulo bias.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0 || maxExclusive > 0xffffffff) {
    throw new Error('maxExclusive must be between 1 and 2^32');
  }
  const maxUint32 = 0x100000000; // 2^32
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % maxExclusive;
    }
  }
}

function generateNumericPasscode(): string {
  const num = secureRandomInt(900000) + 100000;
  return num.toString();
}

function generateTicketId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused 0/O, 1/I
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

export interface PairingTicketDiagnostics {
  anonUserId: string;
  usedAt: number | null;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

export interface PairingTicketRepository {
  clearPreviousTickets(anonUserId: string): Promise<void>;
  createTicket(ticket: PairingTicket): Promise<boolean>;
  claimTicket(ticketId: string, passcodeHash: string, currentAnonUserId: string): Promise<string | null>;
  recordFailedAttempt(ticketId: string): Promise<{ attempts: number; maxAttempts: number } | null>;
  getTicketDiagnostics(ticketId: string): Promise<PairingTicketDiagnostics | null>;
  rollbackTicket(ticketId: string): Promise<void>;
}

class PostgresPairingTicketRepository implements PairingTicketRepository {
  constructor(private databaseUrl: string) { }

  private get sql() {
    return neon(this.databaseUrl);
  }

  async clearPreviousTickets(anonUserId: string): Promise<void> {
    await this.sql`
      DELETE FROM anonymous_pairing_tickets
      WHERE anon_user_id = ${anonUserId}
    `;
  }

  async createTicket(ticket: PairingTicket): Promise<boolean> {
    const expiresAtDate = new Date(ticket.expiresAt * 1000).toISOString();
    try {
      await this.sql`
        INSERT INTO anonymous_pairing_tickets (
          ticket_id, anon_user_id, passcode_hash, attempts, max_attempts, expires_at
        ) VALUES (
          ${ticket.ticketId}, ${ticket.anonUserId}, ${ticket.passcodeHash}, ${ticket.attempts}, ${ticket.maxAttempts}, ${expiresAtDate}
        )
      `;
      return true;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
        return false;
      }
      throw err;
    }
  }

  async claimTicket(ticketId: string, passcodeHash: string, currentAnonUserId: string): Promise<string | null> {
    const rows = await this.sql`
      UPDATE anonymous_pairing_tickets
      SET used_at = COALESCE(used_at, now())
      WHERE ticket_id = ${ticketId}
        AND passcode_hash = ${passcodeHash}
        AND expires_at > now()
        AND attempts < max_attempts
        AND anon_user_id != ${currentAnonUserId}
      RETURNING anon_user_id
    `;
    return rows.length > 0 ? rows[0].anon_user_id : null;
  }

  async recordFailedAttempt(ticketId: string): Promise<{ attempts: number; maxAttempts: number } | null> {
    const rows = await this.sql`
      UPDATE anonymous_pairing_tickets
      SET attempts = attempts + 1
      WHERE ticket_id = ${ticketId}
        AND expires_at > now()
        AND attempts < max_attempts
      RETURNING attempts, max_attempts
    `;
    if (rows.length === 0) return null;
    const attempts = Number(rows[0].attempts);
    const maxAttempts = Number(rows[0].max_attempts);
    if (attempts >= maxAttempts) {
      await this.sql`DELETE FROM anonymous_pairing_tickets WHERE ticket_id = ${ticketId}`;
    }
    return { attempts, maxAttempts };
  }

  async getTicketDiagnostics(ticketId: string): Promise<PairingTicketDiagnostics | null> {
    const rows = await this.sql`
      SELECT anon_user_id,
             extract(epoch from used_at)::integer as used_at,
             extract(epoch from expires_at)::integer as expires_at,
             attempts, max_attempts
      FROM anonymous_pairing_tickets
      WHERE ticket_id = ${ticketId}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return {
      anonUserId: rows[0].anon_user_id,
      usedAt: rows[0].used_at !== null ? Number(rows[0].used_at) : null,
      expiresAt: Number(rows[0].expires_at),
      attempts: Number(rows[0].attempts),
      maxAttempts: Number(rows[0].max_attempts),
    };
  }

  async rollbackTicket(ticketId: string): Promise<void> {
    await this.sql`
      UPDATE anonymous_pairing_tickets
      SET used_at = NULL
      WHERE ticket_id = ${ticketId}
    `;
  }
}

class MemoryPairingTicketRepository implements PairingTicketRepository {
  async clearPreviousTickets(anonUserId: string): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [key, ticket] of localTickets.entries()) {
      if (ticket.expiresAt < nowSec || ticket.anonUserId === anonUserId) {
        localTickets.delete(key);
      }
    }
  }

  async createTicket(ticket: PairingTicket): Promise<boolean> {
    if (localTickets.has(ticket.ticketId)) {
      return false;
    }
    localTickets.set(ticket.ticketId, ticket);
    return true;
  }

  async claimTicket(ticketId: string, passcodeHash: string, currentAnonUserId: string): Promise<string | null> {
    const ticket = localTickets.get(ticketId);
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      !ticket ||
      ticket.expiresAt <= nowSec ||
      ticket.attempts >= ticket.maxAttempts ||
      ticket.anonUserId === currentAnonUserId ||
      ticket.passcodeHash !== passcodeHash
    ) {
      return null;
    }
    if (ticket.usedAt === null) {
      ticket.usedAt = nowSec;
    }
    return ticket.anonUserId;
  }

  async recordFailedAttempt(ticketId: string): Promise<{ attempts: number; maxAttempts: number } | null> {
    const ticket = localTickets.get(ticketId);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!ticket || ticket.expiresAt <= nowSec || ticket.attempts >= ticket.maxAttempts) {
      return null;
    }
    ticket.attempts += 1;
    if (ticket.attempts >= ticket.maxAttempts) {
      localTickets.delete(ticketId);
    }
    return { attempts: ticket.attempts, maxAttempts: ticket.maxAttempts };
  }

  async getTicketDiagnostics(ticketId: string): Promise<PairingTicketDiagnostics | null> {
    const ticket = localTickets.get(ticketId);
    if (!ticket) return null;
    return {
      anonUserId: ticket.anonUserId,
      usedAt: ticket.usedAt,
      expiresAt: ticket.expiresAt,
      attempts: ticket.attempts,
      maxAttempts: ticket.maxAttempts,
    };
  }

  async rollbackTicket(ticketId: string): Promise<void> {
    const ticket = localTickets.get(ticketId);
    if (ticket) {
      ticket.usedAt = null;
    }
  }
}

function getPairingTicketRepository(): PairingTicketRepository {
  const databaseUrl = getDatabaseUrl();
  const isDbEnabled = Boolean(databaseUrl && process.env.PAIRING_DB_DISABLED !== 'true');
  return isDbEnabled
    ? new PostgresPairingTicketRepository(databaseUrl!)
    : new MemoryPairingTicketRepository();
}

export interface CreatePairingResult {
  ticketId: string;
  passcode: string;
  fullCode: string;
  expiresAt: number;
}

/**
 * Creates an ephemeral pairing ticket (Ticket ID + 6-digit Passcode) for an authenticated anonymous user ID.
 */
export async function createPairingTicket(
  anonUserId: string,
  customPasscode?: string
): Promise<CreatePairingResult> {
  if (!isValidAnonymousUserId(anonUserId)) {
    throw new Error('Valid authenticated anonymous session required to create pairing code');
  }

  const passcode = customPasscode !== undefined
    ? normalizePairingCode(customPasscode)
    : generateNumericPasscode();

  const passcodeHash = await hashCode(passcode);
  const expiresAt = Math.floor(Date.now() / 1000) + PAIRING_TICKET_TTL_SECONDS;
  const repo = getPairingTicketRepository();

  await repo.clearPreviousTickets(anonUserId);

  let ticketId = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidateId = generateTicketId();
    const created = await repo.createTicket({
      ticketId: candidateId,
      anonUserId,
      passcodeHash,
      attempts: 0,
      maxAttempts: PAIRING_MAX_ATTEMPTS,
      expiresAt,
      usedAt: null,
    });
    if (created) {
      ticketId = candidateId;
      break;
    }
  }

  if (!ticketId) {
    throw new Error('Failed to generate unique sync ticket. Please try again.');
  }

  return {
    ticketId,
    passcode,
    fullCode: `${ticketId}-${passcode}`,
    expiresAt,
  };
}

export interface RedeemPairingOptions {
  ticketId?: string;
  passcode?: string;
  fullCode?: string;
  currentAnonUserId: string;
}

/**
 * Validates a pairing ticket without consuming it. The ticket remains usable by
 * additional devices until its short expiration window closes.
 */
export async function redeemPairingTicket(options: RedeemPairingOptions): Promise<{ targetAnonUserId: string }> {
  let { ticketId, passcode, fullCode, currentAnonUserId } = options;

  if (fullCode) {
    const parsed = parseFullCode(fullCode);
    ticketId = parsed.ticketId;
    passcode = parsed.passcode;
  }

  if (!ticketId || !passcode) {
    throw new Error('Please enter both the Sync ID and 6-digit passcode.');
  }

  const normalizedTicketId = normalizeTicketId(ticketId);
  const normalizedPasscode = normalizePairingCode(passcode);

  if (!isValidAnonymousUserId(currentAnonUserId)) {
    throw new Error('Valid authenticated anonymous session required on this device.');
  }

  const candidateHash = await hashCode(normalizedPasscode);
  const repo = getPairingTicketRepository();

  // 1. Attempt atomic claim
  const targetAnonUserId = await repo.claimTicket(normalizedTicketId, candidateHash, currentAnonUserId);
  if (targetAnonUserId) {
    return { targetAnonUserId };
  }

  // 2. Claim failed. Check diagnostics to identify if ticket is missing, self-pairing, or expired
  const diag = await repo.getTicketDiagnostics(normalizedTicketId);
  if (!diag) {
    throw new Error('Invalid or expired sync code.');
  }
  if (diag.anonUserId === currentAnonUserId) {
    throw new Error('This device is already using this session.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (diag.expiresAt <= now) {
    throw new Error('This sync code has expired. Please generate a new code on your primary device.');
  }
  if (diag.attempts >= diag.maxAttempts) {
    throw new Error('Code invalidated due to too many failed attempts. Please generate a new code.');
  }

  // 3. Ticket is active and valid, but passcode was incorrect. Record failed attempt.
  const attemptResult = await repo.recordFailedAttempt(normalizedTicketId);
  if (attemptResult) {
    const { attempts, maxAttempts } = attemptResult;
    if (attempts >= maxAttempts) {
      throw new Error('Code invalidated due to too many failed attempts. Please generate a new code.');
    }
    const remaining = maxAttempts - attempts;
    throw new Error(`Incorrect passcode. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
  }

  throw new Error('Invalid or expired sync code.');
}

/**
 * Clears the first-redemption marker if downstream transactional operations fail.
 */
export async function rollbackPairingTicket(ticketId?: string): Promise<void> {
  if (!ticketId) return;
  const normalizedTicketId = ticketId.trim().toUpperCase();
  const repo = getPairingTicketRepository();
  await repo.rollbackTicket(normalizedTicketId);
}
