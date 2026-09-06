import { describe, it, expect, beforeEach } from 'vitest';
import { migrateAnonymousIdentity } from '../identity-migration';

describe('IdentityMigrationService', () => {
  beforeEach(() => {
    process.env.PAIRING_DB_DISABLED = 'true';
  });

  it('rejects unauthenticated/malformed source user ID', async () => {
    await expect(
      migrateAnonymousIdentity('victim_123', 'anon_11111111-2222-3333-4444-555555555555')
    ).rejects.toThrow('Both source and target must be valid authenticated anonymous user identities.');
  });

  it('rejects unauthenticated/malformed target user ID', async () => {
    await expect(
      migrateAnonymousIdentity('anon_11111111-2222-3333-4444-555555555555', 'victim_123')
    ).rejects.toThrow('Both source and target must be valid authenticated anonymous user identities.');
  });

  it('handles identity no-op when fromUserId equals toUserId', async () => {
    const userId = 'anon_11111111-2222-3333-4444-555555555555';
    await expect(migrateAnonymousIdentity(userId, userId)).resolves.toBeUndefined();
  });

  it('executes cleanly when both user IDs are valid anonymous IDs', async () => {
    const fromUser = 'anon_11111111-2222-3333-4444-555555555555';
    const toUser = 'anon_22222222-3333-4444-5555-666666666666';
    await expect(migrateAnonymousIdentity(fromUser, toUser)).resolves.toBeUndefined();
  });
});
