/**
 * Helpers for encoding and decoding anonymous session pairing URLs and parameters.
 */

export interface ParsedPairingParams {
  ticketId: string;
  passcode: string;
}

/**
 * Builds the full URL to open on another device to initiate session sync.
 */
export function buildPairingUrl(origin: string, ticketId: string, passcode: string): string {
  const cleanTicket = ticketId.trim().toUpperCase();
  const cleanPasscode = passcode.trim();
  const base = (origin || '').replace(/\/+$/, '');
  return `${base}/?sync=${encodeURIComponent(cleanTicket)}&passcode=${encodeURIComponent(cleanPasscode)}`;
}

/**
 * Extracts and validates pairing parameters from a URL search query string.
 * Supports:
 * - ?sync=A7B2&passcode=123456
 * - ?ticketId=A7B2&passcode=123456
 * - ?pair=A7B2-123456 (or A7B2123456)
 */
export function extractPairingParams(search: string): ParsedPairingParams | null {
  if (!search || typeof search !== 'string') {
    return null;
  }

  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    let ticket = params.get('sync') || params.get('ticketId') || params.get('ticket');
    let passcode = params.get('passcode') || params.get('pass');
    const pair = params.get('pair') || params.get('code');

    if ((!ticket || !passcode) && pair) {
      const trimmedPair = pair.trim();
      const match = trimmedPair.match(/^([A-Za-z0-9]{4})[- \t]*(\d{6})$/);
      if (match) {
        ticket = match[1];
        passcode = match[2];
      }
    }

    if (!ticket || !passcode) {
      return null;
    }

    const cleanTicket = ticket.trim().toUpperCase();
    const cleanPasscode = passcode.trim().replace(/\D/g, '');

    // Validate 4-character ticket and 6-digit passcode
    if (!/^[A-Za-z0-9]{4}$/.test(cleanTicket) || cleanPasscode.length !== 6) {
      return null;
    }

    return {
      ticketId: cleanTicket,
      passcode: cleanPasscode,
    };
  } catch {
    return null;
  }
}
