import type {
  SsoAttemptRecord,
  SsoFlowStore,
  SsoPendingRecord,
} from "@/api/models/sso-flow-store";

/** `SsoFlowStore` in memory, with the same single-use semantics as the Drizzle one. */
export const createMemorySsoFlowStore = () => {
  let attempts: SsoAttemptRecord[] = [];
  let pending: SsoPendingRecord[] = [];

  const store: SsoFlowStore = {
    consumeAttempt: async stateHash => {
      const found = attempts.find(one => one.stateHash === stateHash) ?? null;
      attempts = attempts.filter(one => one !== found);

      return await Promise.resolve(found);
    },
    consumePending: async ({ now, tokenHash }) => {
      const found =
        pending.find(
          one => one.tokenHash === tokenHash && one.expiresAt > now,
        ) ?? null;
      pending = pending.filter(one => one.tokenHash !== tokenHash);

      return await Promise.resolve(found);
    },
    countCodeAttempt: async ({ maxAttempts, now, tokenHash }) => {
      const found = pending.find(
        one =>
          one.tokenHash === tokenHash &&
          one.expiresAt > now &&
          one.codeHash !== null &&
          one.codeExpiresAt !== null &&
          one.codeExpiresAt > now &&
          one.codeAttempts < maxAttempts,
      );
      if (found) found.codeAttempts += 1;

      return await Promise.resolve(found ? { ...found } : null);
    },
    findPending: async ({ now, tokenHash }) =>
      await Promise.resolve(
        pending.find(
          one => one.tokenHash === tokenHash && one.expiresAt > now,
        ) ?? null,
      ),
    saveAttempt: async (record, now) => {
      attempts = [...attempts.filter(one => one.expiresAt > now), record];
      await Promise.resolve();
    },
    savePending: async (record, now) => {
      pending = [
        ...pending.filter(one => one.expiresAt > now),
        {
          ...record,
          codeAttempts: 0,
          codeExpiresAt: null,
          codeHash: null,
          codeSends: 0,
          codeSentAt: null,
          email: null,
        },
      ];
      await Promise.resolve();
    },
    setPendingCode: async ({
      codeExpiresAt,
      codeHash,
      cooldownMs,
      email,
      maxSends,
      now,
      tokenHash,
    }) => {
      const found = pending.find(
        one =>
          one.tokenHash === tokenHash &&
          one.expiresAt > now &&
          one.codeSends < maxSends &&
          (one.codeSentAt === null ||
            one.codeSentAt.getTime() <= now.getTime() - cooldownMs),
      );
      if (found) {
        Object.assign(found, {
          codeAttempts: 0,
          codeExpiresAt,
          codeHash,
          codeSends: found.codeSends + 1,
          codeSentAt: now,
          email,
        });
      }

      return await Promise.resolve(found !== undefined);
    },
  };

  return {
    attempts: () => attempts,
    pending: () => pending,
    store,
  };
};
