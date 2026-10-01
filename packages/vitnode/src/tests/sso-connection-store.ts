import type {
  SsoConnectionRecord,
  SsoConnectionStore,
  SsoOperationRecord,
  SsoProfileSourceRecord,
} from "@/api/models/sso-connection-store";
import type { SsoProfileField } from "@/lib/sso-profile";

export interface MemorySsoAccount {
  avatarId: null | number;
  email: string;
  firstName: null | string;
  hasPassword: boolean;
  id: number;
  lastName: null | string;
  name: string;
  passkeys: number;
  roleId: number;
  showRealName: boolean;
}

const tick = async () =>
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });

export const createMemorySsoConnectionStore = (
  accounts: MemorySsoAccount[],
) => {
  const users = new Map(accounts.map(account => [account.id, { ...account }]));
  const connections: SsoConnectionRecord[] = [];
  const sources: (SsoProfileSourceRecord & { userId: number })[] = [];
  let operations: SsoOperationRecord[] = [];
  const locks = new Map<number, Promise<void>>();

  const withUserLock = async <T>(
    userId: number,
    run: () => Promise<T>,
  ): Promise<T> => {
    const result = (locks.get(userId) ?? Promise.resolve()).then(run);
    locks.set(
      userId,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );

    return await result;
  };

  const connectionOf = (userId: number, providerId: string) =>
    connections.find(
      one => one.userId === userId && one.providerId === providerId,
    );

  const store: SsoConnectionStore = {
    clearSources: async ({ fields, userId }) => {
      const removed: SsoProfileField[] = [];
      for (let index = sources.length - 1; index >= 0; index--) {
        const source = sources[index];
        if (source?.userId === userId && fields.includes(source.field)) {
          removed.push(source.field);
          sources.splice(index, 1);
        }
      }

      return Promise.resolve(removed);
    },

    consumeOperation: async tokenHash => {
      const found = operations.find(one => one.tokenHash === tokenHash);
      operations = operations.filter(one => one !== found);

      return Promise.resolve(found ?? null);
    },

    deleteExpiredOperations: async now => {
      operations = operations.filter(one => one.expiresAt > now);
      await Promise.resolve();
    },

    disconnect: async ({ canDisconnect, providerId, userId }) =>
      await withUserLock(userId, async () => {
        const user = users.get(userId);
        const connection = connectionOf(userId, providerId);
        if (!(user && connection)) return "not_found";

        const facts = {
          hasPassword: user.hasPassword,
          otherSsoProviderIds: connections
            .filter(
              one => one.userId === userId && one.providerId !== providerId,
            )
            .map(one => one.providerId),
          passkeys: user.passkeys,
        };
        await tick();

        if (!canDisconnect(facts)) return "blocked";
        if (!connections.includes(connection)) return "not_found";

        connections.splice(connections.indexOf(connection), 1);
        for (let index = sources.length - 1; index >= 0; index--) {
          const source = sources[index];
          if (source?.userId === userId && source.providerId === providerId) {
            sources.splice(index, 1);
          }
        }
        operations = operations.filter(
          one => !(one.userId === userId && one.providerId === providerId),
        );

        return "disconnected";
      }),

    findConnection: async ({ providerId, userId }) =>
      Promise.resolve(connectionOf(userId, providerId) ?? null),

    findPreview: async ({ now, providerId, userId }) =>
      Promise.resolve(
        operations.find(
          one =>
            one.intent === "preview" &&
            one.userId === userId &&
            one.providerId === providerId &&
            one.expiresAt > now,
        ) ?? null,
      ),

    link: async values => {
      const owner = connections.find(
        one =>
          one.providerId === values.providerId &&
          one.providerAccountId === values.providerAccountId,
      );
      if (owner) {
        return Promise.resolve(
          owner.userId === values.userId ? "already_linked" : "taken",
        );
      }
      if (connectionOf(values.userId, values.providerId)) {
        return Promise.resolve("provider_in_use");
      }

      connections.push({
        ...values,
        avatarFileId: null,
        avatarSha256: null,
        avatarSourceUrl: null,
        createdAt: new Date(),
        syncOnSignIn: false,
      });

      return Promise.resolve("linked");
    },

    listConnections: async userId =>
      Promise.resolve(connections.filter(one => one.userId === userId)),

    listSources: async userId =>
      Promise.resolve(
        sources
          .filter(one => one.userId === userId)
          .map(({ field, providerId }) => ({ field, providerId })),
      ),

    readAccount: async userId => {
      const user = users.get(userId);
      if (!user) return Promise.resolve(null);

      return Promise.resolve({
        avatarId: user.avatarId,
        email: user.email,
        firstName: user.firstName,
        id: user.id,
        lastName: user.lastName,
        name: user.name,
        roleId: user.roleId,
      });
    },

    recordAvatar: async ({ fileId, providerId, sha256, sourceUrl, userId }) => {
      const connection = connectionOf(userId, providerId);
      if (connection) {
        connection.avatarFileId = fileId;
        connection.avatarSha256 = sha256;
        connection.avatarSourceUrl = sourceUrl;
      }
      const user = users.get(userId);
      if (user) user.avatarId = fileId;
      await Promise.resolve();
    },

    recordSignIn: async ({
      providerEmail,
      providerId,
      providerUsername,
      userId,
    }) => {
      const connection = connectionOf(userId, providerId);
      if (connection) {
        connection.providerEmail = providerEmail;
        connection.providerUsername = providerUsername;
      }
      await Promise.resolve();
    },

    savePreferences: async ({ sources: next, sync, userId }) => {
      for (const [providerId, syncOnSignIn] of Object.entries(sync)) {
        const connection = connectionOf(userId, providerId);
        if (connection) connection.syncOnSignIn = syncOnSignIn;
      }

      for (const [field, providerId] of Object.entries(next) as [
        SsoProfileField,
        null | string | undefined,
      ][]) {
        if (providerId === undefined) continue;

        const index = sources.findIndex(
          one => one.userId === userId && one.field === field,
        );
        if (index >= 0) sources.splice(index, 1);
        if (providerId === null) continue;
        if (!connectionOf(userId, providerId)) {
          return Promise.resolve("not_connected");
        }

        sources.push({ field, providerId, userId });
      }

      return Promise.resolve("saved");
    },

    saveOperation: async values => {
      operations.push(values);
      await Promise.resolve();
    },

    savePreview: async values => {
      operations = operations.filter(
        one =>
          !(
            one.intent === "preview" &&
            one.userId === values.userId &&
            one.providerId === values.providerId
          ),
      );
      operations.push(values);
      await Promise.resolve();
    },

    signInFacts: async userId => {
      const user = users.get(userId);

      return Promise.resolve({
        hasPassword: user?.hasPassword ?? false,
        passkeys: user?.passkeys ?? 0,
      });
    },

    takePreview: async ({ now, providerId, userId }) => {
      const found = operations.find(
        one =>
          one.intent === "preview" &&
          one.userId === userId &&
          one.providerId === providerId &&
          one.expiresAt > now,
      );
      operations = operations.filter(one => one !== found);

      return Promise.resolve(found ?? null);
    },

    writeNames: async ({ userId, values }) => {
      const user = users.get(userId);
      if (user) Object.assign(user, values);
      await Promise.resolve();
    },
  };

  const connect = (
    userId: number,
    providerId: string,
    providerAccountId: string,
    extra: Partial<SsoConnectionRecord> = {},
  ) => {
    connections.push({
      avatarFileId: null,
      avatarSha256: null,
      avatarSourceUrl: null,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      providerAccountId,
      providerEmail: null,
      providerId,
      providerUsername: null,
      syncOnSignIn: false,
      userId,
      ...extra,
    });
  };

  return {
    connect,
    connections,
    operations: () => operations,
    sources,
    store,
    users,
  };
};
