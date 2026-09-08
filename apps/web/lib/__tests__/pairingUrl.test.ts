import { describe, it, expect } from 'vitest';
import { buildPairingUrl, extractPairingParams } from '../pairingUrl';

describe('pairingUrl', () => {
  describe('buildPairingUrl', () => {
    it('creates a proper redirect URL with query params', () => {
      const url = buildPairingUrl('https://aralspace.com', 'A7B2', '123456');
      expect(url).toBe('https://aralspace.com/?sync=A7B2&passcode=123456');
    });

    it('handles trailing slash on origin and lowercased ticket', () => {
      const url = buildPairingUrl('https://aralspace.com/', 'a7b2', '654321');
      expect(url).toBe('https://aralspace.com/?sync=A7B2&passcode=654321');
    });

    it('handles empty origin', () => {
      const url = buildPairingUrl('', 'A7B2', '123456');
      expect(url).toBe('/?sync=A7B2&passcode=123456');
    });
  });

  describe('extractPairingParams', () => {
    it('extracts sync and passcode from standard query params', () => {
      const parsed = extractPairingParams('?sync=A7B2&passcode=123456');
      expect(parsed).toEqual({ ticketId: 'A7B2', passcode: '123456' });
    });

    it('uppercases ticketId and strips non-digits from passcode', () => {
      const parsed = extractPairingParams('?sync=k9m2&passcode=123-456');
      expect(parsed).toEqual({ ticketId: 'K9M2', passcode: '123456' });
    });

    it('extracts from ticketId and pass aliases', () => {
      const parsed = extractPairingParams('?ticketId=Z9X1&pass=987654');
      expect(parsed).toEqual({ ticketId: 'Z9X1', passcode: '987654' });
    });

    it('extracts from pair=TICKET-PASSCODE single parameter', () => {
      const parsed = extractPairingParams('?pair=B3F1-112233');
      expect(parsed).toEqual({ ticketId: 'B3F1', passcode: '112233' });
    });

    it('extracts from pair=TICKETPASSCODE single parameter without dash', () => {
      const parsed = extractPairingParams('?pair=b3f1112233');
      expect(parsed).toEqual({ ticketId: 'B3F1', passcode: '112233' });
    });

    it('returns null if parameters are missing or invalid', () => {
      expect(extractPairingParams('')).toBeNull();
      expect(extractPairingParams('?sync=A7B')).toBeNull(); // 3 chars
      expect(extractPairingParams('?sync=A7B2&passcode=123')).toBeNull(); // 3 digits
      expect(extractPairingParams('?random=true')).toBeNull();
    });
  });
});
