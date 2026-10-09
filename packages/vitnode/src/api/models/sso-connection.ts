import type { Context } from "hono";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { SsoConnectionIntent, SsoProfileField } from "@/lib/sso-profile";

import { describeError } from "@/api/lib/error-details";
import { isPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { resolvePersonalInfoPolicy } from "@/api/lib/personal-info-policy";
import { hashSessionToken } from "@/api/lib/session-token";
import {
  type AvatarImportOutcome,
  type AvatarImportRequest,
  importProviderAvatar,
} from "@/api/lib/sso-avatar-import";
import {
  normalizeSsoProfile,
  PROFILE_VALUE_KEY,
  restrictProfile,
  supportedProfileFields,
} from "@/api/lib/sso-profile";
import { resolveUserImagePolicy } from "@/api/lib/user-images";
import { CONFIG } from "@/lib/config";
import { normalizeEmailAddress } from "@/lib/email-canonical";
import {
  SSO_CONNECTION_STATE_PREFIX,
  SSO_PROFILE_FIELDS,
  ssoConnectionIntentOfState,
} from "@/lib/sso-profile";

import type { SSOApiPlugin } from "./sso";
import type {
  SsoAccountProfile,
  SsoConnectionRecord,
  SsoConnectionStore,
  SsoProfileValues,
  SsoSignInFacts,
} from "./sso-connection-store";

import { invalidateSessionCacheForUser } from "./session-revoke";
import { drizzleSsoConnectionStore } from "./sso-connection-store";

export const SSO_CONNECTION_STATE_TTL_MS = 10 * 60_000;

const SSO_IMPORT_PREVIEW_TTL_MS = 10 * 60_000;

export type SsoConnectionErrorCode =
  | "account_mismatch"
  | "account_taken"
  | "invalid_fields"
  | "invalid_source"
  | "invalid_state"
  | "last_sign_in_method"
  | "not_connected"
  | "nothing_to_sync"
  | "preview_not_found"
  | "provider_already_connected"
  | "provider_error"
  | "provider_not_found";

type SsoConnectionErrorStatus = 400 | 404 | 409 | 502;

export class SsoConnectionError extends Error {
  constructor(code: SsoConnectionErrorCode, status: SsoConnectionErrorStatus) {
    super(code);
    this.name = "SsoConnectionError";
    this.code = code;
    this.status = status;
  }

  readonly code: SsoConnectionErrorCode;
  readonly status: SsoConnectionErrorStatus;
}

export type SsoFieldOutcome =
  | "failed"
  | "missing"
  | "not_allowed"
  | "unchanged"
  | "updated";

export type SsoFieldOutcomes = Partial<
  Record<SsoProfileField, SsoFieldOutcome>
>;

export interface SsoProfilePolicy {
  avatar: { allowed: boolean; maxBytes: number };
  firstName: boolean;
  lastName: boolean;
}

export interface SsoProviderIdentity {
  email: null | string;
  id: string;
  profile: SsoProfileValues;
  username: null | string;
}

type SsoSyncTrigger = "import" | "sign_in" | "sync";

const PROVIDER_TEXT_MAX_LENGTH = 255;

const boundedText = (value: unknown): null | string => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= PROVIDER_TEXT_MAX_LENGTH
    ? trimmed
    : null;
};

const keepsSignInMethod = ({
  configuredProviderIds,
  facts,
  passkeysEnabled,
  passwordEnabled,
}: {
  configuredProviderIds: readonly string[];
  facts: SsoSignInFacts;
  passkeysEnabled: boolean;
  passwordEnabled: boolean;
}): boolean =>
  (passwordEnabled && facts.hasPassword) ||
  (passkeysEnabled && facts.passkeys > 0) ||
  facts.otherSsoProviderIds.some(id => configuredProviderIds.includes(id));

const randomState = (intent: SsoConnectionIntent): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return `${SSO_CONNECTION_STATE_PREFIX[intent]}${Array.from(bytes, byte =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
};

const uniqueFields = (fields: readonly SsoProfileField[]): SsoProfileField[] =>
  SSO_PROFILE_FIELDS.filter(field => fields.includes(field));

const toPublicConnection = (connection: SsoConnectionRecord) => ({
  accountLabel: connection.providerEmail ?? connection.providerUsername,
  connectedAt: connection.createdAt,
  email: connection.providerEmail,
  syncOnSignIn: connection.syncOnSignIn,
});

export class SsoConnectionModel {
  constructor(c: Context<EnvVitNode>) {
    this.c = c;
  }

  protected readonly c: Context<EnvVitNode>;

  private adapter(providerId: string): SSOApiPlugin {
    const adapter = this.adapters.find(one => one.id === providerId);
    if (!adapter) throw new SsoConnectionError("provider_not_found", 404);

    return adapter;
  }

  private async applyAvatar({
    account,
    connection,
    policy,
    profile,
  }: {
    account: SsoAccountProfile;
    connection: SsoConnectionRecord;
    policy: SsoProfilePolicy;
    profile: SsoProfileValues;
  }): Promise<SsoFieldOutcome> {
    if (!profile.avatarUrl) return "missing";
    if (!policy.avatar.allowed) return "not_allowed";

    try {
      const outcome = await this.importAvatar({
        currentAvatarId: account.avatarId,
        maxBytes: policy.avatar.maxBytes,
        previous: {
          fileId: connection.avatarFileId,
          sha256: connection.avatarSha256,
          sourceUrl: connection.avatarSourceUrl,
        },
        url: profile.avatarUrl,
        userId: account.id,
      });

      if (outcome.status === "unchanged") return "unchanged";

      await this.store.recordAvatar({
        fileId: outcome.fileId,
        providerId: connection.providerId,
        sha256: outcome.sha256,
        sourceUrl: outcome.sourceUrl,
        userId: account.id,
      });

      return "updated";
    } catch (error) {
      this.warn("avatar import", error);

      return "failed";
    }
  }

  private async applyProfile({
    connection,
    fields,
    profile,
    trigger,
  }: {
    connection: SsoConnectionRecord;
    fields: readonly SsoProfileField[];
    profile: SsoProfileValues;
    trigger: SsoSyncTrigger;
  }): Promise<SsoFieldOutcomes> {
    const account = await this.store.readAccount(connection.userId);
    if (!account) throw new SsoConnectionError("not_connected", 404);

    const policy = await this.profilePolicy(account);
    const results: SsoFieldOutcomes = {};
    const names: Partial<Pick<SsoProfileValues, "firstName" | "lastName">> = {};

    for (const field of ["firstName", "lastName"] as const) {
      if (!fields.includes(field)) continue;

      const value = profile[field];
      if (!value) {
        results[field] = "missing";
      } else if (!policy[field]) {
        results[field] = "not_allowed";
      } else if (account[field] === value) {
        results[field] = "unchanged";
      } else {
        names[field] = value;
        results[field] = "updated";
      }
    }

    if (Object.keys(names).length > 0) {
      await this.store.writeNames({ userId: account.id, values: names });
      await this.refreshSessions(account.id);
      await this.c.get("events").emit("user.updated", {
        email: account.email,
        name: account.name,
        userId: account.id,
      });
    }

    if (fields.includes("avatar")) {
      results.avatar = await this.applyAvatar({
        account,
        connection,
        policy,
        profile,
      });
    }

    const updated = SSO_PROFILE_FIELDS.filter(
      field => results[field] === "updated",
    );
    if (updated.length > 0) {
      await this.c.get("events").emit("user.sso.profile_synced", {
        fields: updated,
        providerId: connection.providerId,
        trigger,
        userId: account.id,
      });
    }

    return results;
  }

  private async fetchIdentity(
    adapter: SSOApiPlugin,
    code: string,
  ): Promise<SsoProviderIdentity> {
    let user: Awaited<ReturnType<SSOApiPlugin["fetchUser"]>>;
    try {
      user = await adapter.fetchUser(await adapter.fetchToken(code));
    } catch (error) {
      this.warn("provider request", error);
      throw new SsoConnectionError("provider_error", 502);
    }

    const id = boundedText(user.id);
    if (!id) throw new SsoConnectionError("provider_error", 502);

    return ssoIdentityOf(adapter, { ...user, id });
  }

  private async sourcedFields({
    adapter,
    providerId,
    userId,
  }: {
    adapter: SSOApiPlugin;
    providerId: string;
    userId: number;
  }): Promise<SsoProfileField[]> {
    const supported = supportedProfileFields(adapter);
    const sources = await this.store.listSources(userId);

    return uniqueFields(
      sources
        .filter(
          source =>
            source.providerId === providerId &&
            supported.includes(source.field),
        )
        .map(source => source.field),
    );
  }

  private warn(step: string, error: unknown) {
    if (!CONFIG.node_development) return;

    // oxlint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33mSSO connection ${step} failed:\x1b[0m ${describeError(error)}`,
    );
  }

  async afterSignIn({
    identity,
    providerId,
    userId,
  }: {
    identity: SsoProviderIdentity;
    providerId: string;
    userId: number;
  }): Promise<void> {
    try {
      await this.store.recordSignIn({
        providerEmail: identity.email,
        providerId,
        providerUsername: identity.username,
        userId,
      });

      const connection = await this.store.findConnection({
        providerId,
        userId,
      });
      if (!connection?.syncOnSignIn) return;

      const fields = await this.sourcedFields({
        adapter: this.adapter(providerId),
        providerId,
        userId,
      });
      if (fields.length === 0) return;

      await this.applyProfile({
        connection,
        fields,
        profile: identity.profile,
        trigger: "sign_in",
      });
    } catch (error) {
      this.warn("sign-in sync", error);
    }
  }

  async applyImport({
    fields,
    providerId,
    userId,
  }: {
    fields: readonly SsoProfileField[];
    providerId: string;
    userId: number;
  }): Promise<{ manualFields: SsoProfileField[]; results: SsoFieldOutcomes }> {
    const selected = uniqueFields(fields);
    const preview = await this.store.takePreview({
      now: new Date(),
      providerId,
      userId,
    });

    if (!preview?.preview) {
      throw new SsoConnectionError("preview_not_found", 404);
    }
    if (
      selected.length === 0 ||
      selected.some(field => !preview.fields.includes(field))
    ) {
      throw new SsoConnectionError("invalid_fields", 400);
    }

    const connection = await this.store.findConnection({ providerId, userId });
    if (!connection) throw new SsoConnectionError("not_connected", 404);
    if (connection.providerAccountId !== preview.providerAccountId) {
      throw new SsoConnectionError("account_mismatch", 409);
    }

    const results = await this.applyProfile({
      connection,
      fields: selected,
      profile: preview.preview,
      trigger: "import",
    });

    const sourcedElsewhere = (await this.store.listSources(userId))
      .filter(
        source =>
          source.providerId !== providerId &&
          results[source.field] === "updated",
      )
      .map(source => source.field);
    const manualFields = await this.store.clearSources({
      fields: sourcedElsewhere,
      userId,
    });

    return { manualFields, results };
  }

  async authorize({
    fields = [],
    intent,
    providerId,
    userId,
  }: {
    fields?: readonly SsoProfileField[];
    intent: SsoConnectionIntent;
    providerId: string;
    userId: number;
  }): Promise<{ url: string }> {
    const adapter = this.adapter(providerId);
    const now = new Date();
    await this.store.deleteExpiredOperations(now);

    const connection = await this.store.findConnection({ providerId, userId });
    let bound: SsoProfileField[] = [];

    if (intent === "link") {
      if (connection) {
        throw new SsoConnectionError("provider_already_connected", 409);
      }
    } else if (intent === "sync") {
      if (!connection) throw new SsoConnectionError("not_connected", 404);

      bound = await this.sourcedFields({ adapter, providerId, userId });
      if (bound.length === 0) {
        throw new SsoConnectionError("nothing_to_sync", 400);
      }
    } else {
      if (!connection) throw new SsoConnectionError("not_connected", 404);

      const supported = supportedProfileFields(adapter);
      bound = uniqueFields(fields);
      if (
        bound.length === 0 ||
        bound.some(field => !supported.includes(field))
      ) {
        throw new SsoConnectionError("invalid_fields", 400);
      }
    }

    const state = randomState(intent);
    await this.store.saveOperation({
      expiresAt: new Date(now.getTime() + SSO_CONNECTION_STATE_TTL_MS),
      fields: bound,
      intent,
      preview: null,
      providerAccountId: connection?.providerAccountId ?? null,
      providerId,
      tokenHash: await hashSessionToken(state),
      userId,
    });

    return { url: adapter.getUrl({ state }) };
  }

  async callback({
    code,
    providerId,
    state,
    user,
  }: {
    code: string;
    providerId: string;
    state: string;
    user: { email: string; id: number };
  }): Promise<{
    intent: SsoConnectionIntent;
    providerId: string;
    results?: SsoFieldOutcomes;
  }> {
    const intent = ssoConnectionIntentOfState(state);
    if (!intent) throw new SsoConnectionError("invalid_state", 400);

    const operation = await this.store.consumeOperation(
      await hashSessionToken(state),
    );
    const now = new Date();

    if (
      operation?.intent !== intent ||
      operation.expiresAt <= now ||
      operation.providerId !== providerId ||
      operation.userId !== user.id
    ) {
      throw new SsoConnectionError("invalid_state", 400);
    }

    const adapter = this.adapter(providerId);
    const identity = await this.fetchIdentity(adapter, code);

    if (intent === "link") {
      const outcome = await this.store.link({
        providerAccountId: identity.id,
        providerEmail: identity.email,
        providerId,
        providerUsername: identity.username,
        userId: user.id,
      });

      if (outcome === "taken") {
        throw new SsoConnectionError("account_taken", 409);
      }
      if (outcome === "provider_in_use") {
        throw new SsoConnectionError("provider_already_connected", 409);
      }
      if (outcome === "linked") {
        await this.c.get("events").emit("user.sso.linked", {
          email: user.email,
          providerId,
          userId: user.id,
        });
      }

      return { intent, providerId };
    }

    const connection = await this.store.findConnection({
      providerId,
      userId: user.id,
    });
    if (!connection) throw new SsoConnectionError("not_connected", 404);
    if (connection.providerAccountId !== identity.id) {
      throw new SsoConnectionError("account_mismatch", 409);
    }

    await this.store.recordSignIn({
      providerEmail: identity.email,
      providerId,
      providerUsername: identity.username,
      userId: user.id,
    });

    if (intent === "sync") {
      const stillSourced = await this.sourcedFields({
        adapter,
        providerId,
        userId: user.id,
      });
      const fields = operation.fields.filter(field =>
        stillSourced.includes(field),
      );
      const results =
        fields.length > 0
          ? await this.applyProfile({
              connection,
              fields,
              profile: identity.profile,
              trigger: "sync",
            })
          : {};

      return { intent, providerId, results };
    }

    await this.store.savePreview({
      expiresAt: new Date(now.getTime() + SSO_IMPORT_PREVIEW_TTL_MS),
      fields: operation.fields,
      intent: "preview",
      preview: restrictProfile(identity.profile, operation.fields),
      providerAccountId: identity.id,
      providerId,
      tokenHash: null,
      userId: user.id,
    });

    return { intent, providerId };
  }

  async clearSourcesAfterManualEdit({
    fields,
    userId,
  }: {
    fields: readonly SsoProfileField[];
    userId: number;
  }): Promise<SsoProfileField[]> {
    return await this.store.clearSources({
      fields: uniqueFields(fields),
      userId,
    });
  }

  async discardPreview({
    providerId,
    userId,
  }: {
    providerId: string;
    userId: number;
  }): Promise<void> {
    await this.store.takePreview({ now: new Date(), providerId, userId });
  }

  async disconnect({
    providerId,
    userId,
  }: {
    providerId: string;
    userId: number;
  }): Promise<void> {
    const configuredProviderIds = this.adapters.map(adapter => adapter.id);
    const passwordEnabled = isPasswordSignInEnabled(this.c);
    const passkeysEnabled = this.c.get("core").authorization.passkeys.enabled;

    const outcome = await this.store.disconnect({
      canDisconnect: facts =>
        keepsSignInMethod({
          configuredProviderIds,
          facts,
          passkeysEnabled,
          passwordEnabled,
        }),
      providerId,
      userId,
    });

    if (outcome === "not_found") {
      throw new SsoConnectionError("not_connected", 404);
    }
    if (outcome === "blocked") {
      throw new SsoConnectionError("last_sign_in_method", 409);
    }

    await this.c
      .get("events")
      .emit("user.sso.unlinked", { providerId, userId });
  }

  async importAvatar(
    request: AvatarImportRequest,
  ): Promise<AvatarImportOutcome> {
    return await importProviderAvatar(this.c, request);
  }

  async overview(userId: number) {
    const [connections, sources, facts] = await Promise.all([
      this.store.listConnections(userId),
      this.store.listSources(userId),
      this.store.signInFacts(userId),
    ]);
    const passwordEnabled = isPasswordSignInEnabled(this.c);
    const passkeysEnabled = this.c.get("core").authorization.passkeys.enabled;
    const sourceOf = (field: SsoProfileField) =>
      sources.find(source => source.field === field)?.providerId ?? null;

    const configured = this.adapters.map(adapter => ({
      available: true,
      icon: adapter.icon ?? null,
      id: adapter.id,
      name: adapter.name,
      profileFields: supportedProfileFields(adapter),
    }));
    const orphaned = connections
      .filter(
        connection => !configured.some(one => one.id === connection.providerId),
      )
      .map(connection => ({
        available: false,
        icon: null,
        id: connection.providerId,
        name: connection.providerId,
        profileFields: [],
      }));

    return {
      providers: [...configured, ...orphaned].map(provider => {
        const connection = connections.find(
          one => one.providerId === provider.id,
        );

        return {
          ...provider,
          connection: connection ? toPublicConnection(connection) : null,
        };
      }),
      signIn: {
        hasPassword: passwordEnabled && facts.hasPassword,
        passkeys: passkeysEnabled ? facts.passkeys : 0,
        passkeysEnabled,
        passwordEnabled,
      },
      sources: {
        avatar: sourceOf("avatar"),
        firstName: sourceOf("firstName"),
        lastName: sourceOf("lastName"),
      },
    };
  }

  async preview({
    providerId,
    userId,
  }: {
    providerId: string;
    userId: number;
  }) {
    const operation = await this.store.findPreview({
      now: new Date(),
      providerId,
      userId,
    });
    const account = await this.store.readAccount(userId);
    if (!(operation?.preview && account)) {
      throw new SsoConnectionError("preview_not_found", 404);
    }

    const policy = await this.profilePolicy(account);
    const sources = await this.store.listSources(userId);
    const { preview } = operation;

    return {
      expiresAt: operation.expiresAt,
      fields: operation.fields.map(field => ({
        allowed: field === "avatar" ? policy.avatar.allowed : policy[field],
        current: field === "avatar" ? null : account[field],
        field,
        incoming: preview[PROFILE_VALUE_KEY[field]],
        source:
          sources.find(source => source.field === field)?.providerId ?? null,
      })),
    };
  }

  async profilePolicy(account: {
    id: number;
    roleId: number;
  }): Promise<SsoProfilePolicy> {
    const [personal, images] = await Promise.all([
      resolvePersonalInfoPolicy(this.c, account),
      resolveUserImagePolicy(this.c, account),
    ]);

    return {
      avatar: images.avatar,
      firstName: personal.canEdit && personal.fields.firstName,
      lastName: personal.canEdit && personal.fields.lastName,
    };
  }

  async refreshSessions(userId: number): Promise<void> {
    await invalidateSessionCacheForUser(this.c, userId);
  }

  async savePreferences({
    sources,
    sync,
    userId,
  }: {
    sources: Partial<Record<SsoProfileField, null | string>>;
    sync: Record<string, boolean>;
    userId: number;
  }): Promise<void> {
    const connections = await this.store.listConnections(userId);
    const connected = new Set(connections.map(one => one.providerId));

    for (const field of SSO_PROFILE_FIELDS) {
      const providerId = sources[field];
      if (!providerId) continue;

      const adapter = this.adapters.find(one => one.id === providerId);
      if (
        !(
          connected.has(providerId) &&
          adapter &&
          supportedProfileFields(adapter).includes(field)
        )
      ) {
        throw new SsoConnectionError("invalid_source", 400);
      }
    }

    if (Object.keys(sync).some(providerId => !connected.has(providerId))) {
      throw new SsoConnectionError("invalid_source", 400);
    }

    const outcome = await this.store.savePreferences({ sources, sync, userId });
    if (outcome === "not_connected") {
      throw new SsoConnectionError("not_connected", 409);
    }

    await this.c
      .get("events")
      .emit("user.sso.preferences_updated", { sources, sync, userId });
  }

  private get adapters(): SSOApiPlugin[] {
    return this.c.get("core").authorization.ssoAdapters;
  }

  get store(): SsoConnectionStore {
    return drizzleSsoConnectionStore(this.c.get("db"));
  }
}

export const ssoIdentityOf = (
  adapter: Pick<SSOApiPlugin, "profileFields">,
  user: Awaited<ReturnType<SSOApiPlugin["fetchUser"]>>,
): SsoProviderIdentity => {
  const email = boundedText(user.email);

  return {
    email: email ? normalizeEmailAddress(email) : null,
    id: user.id,
    profile: normalizeSsoProfile(adapter, user),
    username: boundedText(user.username),
  };
};
