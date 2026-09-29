import type {
  PasskeyChallengeRecord,
  PasskeyRecord,
  PasskeyStore,
} from "@/api/models/passkey-store";

export interface MemoryPasskeyAccount {
  hasPassword: boolean;
  ssoProviders: string[];
}

export const createMemoryPasskeyStore = (
  accounts: Record<number, MemoryPasskeyAccount> = {},
) => {
  const challenges = new Map<string, PasskeyChallengeRecord>();
  const passkeys = new Map<number, PasskeyRecord>();
  let nextId = 1;

  const store: PasskeyStore = {
    consumeChallenge: async ({ ceremony, now, tokenHash, userId }) => {
      const row = challenges.get(tokenHash);
      const matches =
        row?.ceremony === ceremony &&
        row.expiresAt > now &&
        row.userId === userId;
      if (!matches) return Promise.resolve(null);
      challenges.delete(tokenHash);

      return Promise.resolve(row);
    },

    createPasskey: async values => {
      const duplicate = [...passkeys.values()].some(
        passkey => passkey.credentialId === values.credentialId,
      );
      if (duplicate) return Promise.resolve(null);

      const now = new Date();
      const row: PasskeyRecord = {
        ...values,
        createdAt: now,
        id: nextId++,
        lastUsedAt: null,
        updatedAt: now,
      };
      passkeys.set(row.id, row);

      return Promise.resolve(row);
    },

    deleteChallenge: async tokenHash => {
      challenges.delete(tokenHash);
      await Promise.resolve();
    },

    deleteExpiredChallenges: async now => {
      for (const [key, row] of challenges) {
        if (row.expiresAt <= now) challenges.delete(key);
      }
      await Promise.resolve();
    },

    deletePasskey: async ({ canDelete, id, ssoProviderIds, userId }) => {
      const passkey = passkeys.get(id);
      if (passkey?.userId !== userId) return Promise.resolve("not_found");

      const { hasPassword, ssoProviders } = accounts[userId] ?? {
        hasPassword: false,
        ssoProviders: [],
      };
      const otherPasskeys = [...passkeys.values()].filter(
        other => other.userId === userId && other.id !== id,
      ).length;
      const ssoAccounts = ssoProviders.filter(providerId =>
        ssoProviderIds.includes(providerId),
      ).length;

      if (!canDelete({ hasPassword, otherPasskeys, ssoAccounts })) {
        return Promise.resolve("blocked");
      }
      passkeys.delete(id);

      return Promise.resolve("deleted");
    },

    findPasskeyByCredentialId: async credentialId =>
      Promise.resolve(
        [...passkeys.values()].find(
          passkey => passkey.credentialId === credentialId,
        ) ?? null,
      ),

    listPasskeys: async userId =>
      Promise.resolve(
        [...passkeys.values()].filter(passkey => passkey.userId === userId),
      ),

    recordSignIn: async ({
      backedUp,
      counter,
      deviceType,
      id,
      previousCounter,
      usedAt,
    }) => {
      const passkey = passkeys.get(id);
      if (passkey?.counter !== previousCounter) return Promise.resolve(false);

      passkeys.set(id, {
        ...passkey,
        backedUp,
        counter,
        deviceType,
        lastUsedAt: usedAt,
      });

      return Promise.resolve(true);
    },

    renamePasskey: async ({ id, name, userId }) => {
      const passkey = passkeys.get(id);
      if (passkey?.userId !== userId) return Promise.resolve(null);

      const renamed = { ...passkey, name, updatedAt: new Date() };
      passkeys.set(id, renamed);

      return Promise.resolve(renamed);
    },

    saveChallenge: async values => {
      challenges.set(values.tokenHash, values);
      await Promise.resolve();
    },
  };

  return { challenges, passkeys, store };
};
