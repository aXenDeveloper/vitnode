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
    consumeConfirmed: async ({ confirmHash, now, tokenHash }) => {
      const found =
        pending.find(
          one =>
            one.tokenHash === tokenHash &&
            one.confirmHash === confirmHash &&
            one.confirmExpiresAt !== null &&
            one.confirmExpiresAt > now &&
            one.expiresAt > now,
        ) ?? null;
      pending = pending.filter(one => one !== found);

      return await Promise.resolve(found);
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
          confirmExpiresAt: null,
          confirmHash: null,
          confirmSends: 0,
          confirmSentAt: null,
          email: null,
        },
      ];
      await Promise.resolve();
    },
    setPendingConfirmation: async ({
      confirmHash,
      cooldownMs,
      email,
      expiresAt,
      maxSends,
      now,
      tokenHash,
    }) => {
      const found = pending.find(
        one =>
          one.tokenHash === tokenHash &&
          one.expiresAt > now &&
          one.confirmSends < maxSends &&
          (one.confirmSentAt === null ||
            one.confirmSentAt.getTime() <= now.getTime() - cooldownMs),
      );
      if (found) {
        Object.assign(found, {
          confirmExpiresAt: expiresAt,
          confirmHash,
          confirmSends: found.confirmSends + 1,
          confirmSentAt: now,
          email,
          expiresAt,
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
