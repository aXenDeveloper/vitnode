import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Context } from "hono";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getCookie } from "hono/cookie";

import type { PasskeyErrorCode } from "@/api/modules/users/passkeys/schema";

import { deleteAuthCookie, setAuthCookie } from "@/api/lib/auth-cookie";
import { isStaff } from "@/api/lib/check-staff-permission";
import { describeError } from "@/api/lib/error-details";
import { isPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { hashSessionToken } from "@/api/lib/session-token";
import { CONFIG } from "@/lib/config";

import type {
  PasskeyCeremony,
  PasskeyRecord,
  PasskeyRecoveryFacts,
  PasskeyStore,
} from "./passkey-store";

import { defaultPasskeyName, normalizePasskeyName } from "./passkey-names";
import { drizzlePasskeyStore } from "./passkey-store";
import { SessionAdminModel } from "./session-admin";

export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60_000;

export const PASSKEY_ADMIN_CHALLENGE_TTL_MS = 2 * 60_000;

const CHALLENGE_TTL_MS: Record<PasskeyCeremony, number> = {
  admin_sign_in: PASSKEY_ADMIN_CHALLENGE_TTL_MS,
  authentication: PASSKEY_CHALLENGE_TTL_MS,
  registration: PASSKEY_CHALLENGE_TTL_MS,
};

export type PasskeySignInCeremony = Exclude<PasskeyCeremony, "registration">;

const ZERO_AAGUID = "00000000-0000-0000-0000-000000000000";

const TRANSPORTS: readonly string[] = [
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
];

const isTransport = (value: string): boolean => TRANSPORTS.includes(value);

export type PasskeyErrorStatus = 400 | 403 | 404 | 409;

export class PasskeyError extends Error {
  constructor(code: PasskeyErrorCode, status: PasskeyErrorStatus) {
    super(code);
    this.name = "PasskeyError";
    this.code = code;
    this.status = status;
  }

  readonly code: PasskeyErrorCode;
  readonly status: PasskeyErrorStatus;
}

export const passkeyChallengeCookieName = (
  c: Context,
  ceremony: PasskeyCeremony,
): string => `${c.get("core").authorization.cookieName}_passkey_${ceremony}`;

export const keepsRecoveryMethod = ({
  hasPassword,
  otherPasskeys,
  ssoAccounts,
}: PasskeyRecoveryFacts): boolean =>
  hasPassword || otherPasskeys > 0 || ssoAccounts > 0;

export const toPublicPasskey = (passkey: PasskeyRecord) => ({
  backedUp: passkey.backedUp,
  createdAt: passkey.createdAt,
  deviceType:
    passkey.deviceType === "multiDevice"
      ? ("multiDevice" as const)
      : ("singleDevice" as const),
  id: passkey.id,
  lastUsedAt: passkey.lastUsedAt,
  name: passkey.name,
  transports: passkey.transports,
});

export type PublicPasskey = ReturnType<typeof toPublicPasskey>;

const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
};

export class PasskeyModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private async assertStaffEnrollmentAllowed(userId: number) {
    if (!(await isStaff(this.c, { live: true, type: "admin", userId }))) return;

    const adminSession = await new SessionAdminModel(this.c).getSession({
      extend: true,
    });
    if (adminSession?.user.id !== userId) {
      throw new PasskeyError("admin_session_required", 403);
    }
  }

  private async consumeChallenge(
    ceremony: PasskeyCeremony,
    userId: null | number,
  ) {
    const cookieName = passkeyChallengeCookieName(this.c, ceremony);
    const token = getCookie(this.c, cookieName);
    deleteAuthCookie(this.c, cookieName);

    if (!token) throw new PasskeyError("invalid_challenge", 400);

    const challenge = await this.store.consumeChallenge({
      ceremony,
      now: new Date(),
      tokenHash: await hashSessionToken(token),
      userId,
    });

    if (!challenge) throw new PasskeyError("invalid_challenge", 400);

    return challenge;
  }

  private enabledConfig() {
    const config = this.c.get("core").authorization.passkeys;
    if (!config.enabled) throw new PasskeyError("passkeys_disabled", 404);

    return config;
  }

  private async issueChallenge({
    ceremony,
    challenge,
    now,
    userId,
    webauthnUserId,
  }: {
    ceremony: PasskeyCeremony;
    challenge: string;
    now: Date;
    userId: null | number;
    webauthnUserId: null | string;
  }) {
    const store = this.store;
    const cookieName = passkeyChallengeCookieName(this.c, ceremony);
    const previous = getCookie(this.c, cookieName);
    if (previous) await store.deleteChallenge(await hashSessionToken(previous));

    const token = randomToken();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS[ceremony]);

    await store.saveChallenge({
      ceremony,
      challenge,
      expiresAt,
      tokenHash: await hashSessionToken(token),
      userId,
      webauthnUserId,
    });

    setAuthCookie(this.c, cookieName, token, { expires: expiresAt });
  }

  private warnInDevelopment(ceremony: PasskeyCeremony, error: unknown) {
    if (!CONFIG.node_development) return;

    // eslint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33mPasskey ${ceremony} failed:\x1b[0m ${describeError(error)}`,
    );
  }

  async authenticationOptions(ceremony: PasskeySignInCeremony) {
    const { rpId } = this.enabledConfig();
    const now = new Date();

    await this.store.deleteExpiredChallenges(now);

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: CHALLENGE_TTL_MS[ceremony],
      userVerification: "required",
    });

    await this.issueChallenge({
      ceremony,
      challenge: options.challenge,
      now,
      userId: null,
      webauthnUserId: null,
    });

    return options;
  }

  async deletePasskey({ id, userId }: { id: number; userId: number }) {
    this.enabledConfig();
    const passwordEnabled = isPasswordSignInEnabled(this.c);
    const outcome = await this.store.deletePasskey({
      canDelete: facts =>
        keepsRecoveryMethod({
          ...facts,
          hasPassword: passwordEnabled && facts.hasPassword,
        }),
      id,
      ssoProviderIds: this.c
        .get("core")
        .authorization.ssoAdapters.map(adapter => adapter.id),
      userId,
    });

    if (outcome === "not_found") throw new PasskeyError("not_found", 404);
    if (outcome === "blocked") {
      throw new PasskeyError("last_recovery_method", 409);
    }

    await this.c
      .get("events")
      .emit("user.passkey.deleted", { passkeyId: id, userId });
  }

  async listPasskeys(userId: number): Promise<PublicPasskey[]> {
    this.enabledConfig();
    const passkeys = await this.store.listPasskeys(userId);

    return passkeys.map(toPublicPasskey);
  }

  async registrationOptions(user: { email: string; id: number; name: string }) {
    const { rpId, rpName } = this.enabledConfig();
    await this.assertStaffEnrollmentAllowed(user.id);
    const store = this.store;
    const now = new Date();

    await store.deleteExpiredChallenges(now);
    const existing = await store.listPasskeys(user.id);
    const webauthnUserId =
      existing[0]?.webauthnUserId ??
      isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32)));

    const options = await generateRegistrationOptions({
      attestationType: "none",
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: existing.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports.filter(isTransport),
      })),
      rpID: rpId,
      rpName,
      timeout: PASSKEY_CHALLENGE_TTL_MS,
      userDisplayName: user.name,
      userID: isoBase64URL.toBuffer(webauthnUserId),
      userName: user.email,
    });

    await this.issueChallenge({
      ceremony: "registration",
      challenge: options.challenge,
      now,
      userId: user.id,
      webauthnUserId,
    });

    return options;
  }

  async renamePasskey({
    id,
    name,
    userId,
  }: {
    id: number;
    name: string;
    userId: number;
  }): Promise<PublicPasskey> {
    this.enabledConfig();
    const normalized = normalizePasskeyName(name);
    const passkey = normalized
      ? await this.store.renamePasskey({ id, name: normalized, userId })
      : null;

    if (!passkey) throw new PasskeyError("not_found", 404);

    await this.c.get("events").emit("user.passkey.updated", {
      name: passkey.name,
      passkeyId: passkey.id,
      userId,
    });

    return toPublicPasskey(passkey);
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    ceremony: PasskeySignInCeremony,
  ): Promise<{ userId: number }> {
    const { origins, rpId } = this.enabledConfig();
    const challenge = await this.consumeChallenge(ceremony, null);
    const store = this.store;
    const denied = new PasskeyError("verification_failed", 403);

    const passkey = await store.findPasskeyByCredentialId(response.id);
    if (!passkey) throw denied;

    const { userHandle } = response.response;
    if (userHandle !== undefined && userHandle !== passkey.webauthnUserId) {
      throw denied;
    }

    const verification = await verifyAuthenticationResponse({
      credential: {
        counter: passkey.counter,
        id: passkey.credentialId,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        transports: passkey.transports.filter(isTransport),
      },
      expectedChallenge: challenge.challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: true,
      response,
    }).catch((error: unknown) => {
      this.warnInDevelopment(ceremony, error);

      return null;
    });

    if (!verification?.verified) throw denied;

    const { credentialBackedUp, credentialDeviceType, newCounter } =
      verification.authenticationInfo;

    const recorded = await store.recordSignIn({
      backedUp: credentialBackedUp,
      counter: newCounter,
      deviceType: credentialDeviceType,
      id: passkey.id,
      previousCounter: passkey.counter,
      usedAt: new Date(),
    });

    if (!recorded) throw denied;

    return { userId: passkey.userId };
  }

  async verifyRegistration({
    name,
    response,
    userId,
  }: {
    name?: string;
    response: RegistrationResponseJSON;
    userId: number;
  }): Promise<PublicPasskey> {
    const { origins, rpId } = this.enabledConfig();
    const challenge = await this.consumeChallenge("registration", userId);
    await this.assertStaffEnrollmentAllowed(userId);

    if (!challenge.webauthnUserId) {
      throw new PasskeyError("invalid_challenge", 400);
    }

    const verification = await verifyRegistrationResponse({
      expectedChallenge: challenge.challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserPresence: true,
      requireUserVerification: true,
      response,
    }).catch((error: unknown) => {
      this.warnInDevelopment("registration", error);

      return null;
    });

    if (!verification?.verified) {
      throw new PasskeyError("verification_failed", 400);
    }

    const { aaguid, credential, credentialBackedUp, credentialDeviceType } =
      verification.registrationInfo;
    const knownAaguid = aaguid && aaguid !== ZERO_AAGUID ? aaguid : null;
    const chosenName = name ? normalizePasskeyName(name) : "";

    const passkey = await this.store.createPasskey({
      aaguid: knownAaguid,
      backedUp: credentialBackedUp,
      counter: credential.counter,
      credentialId: credential.id,
      deviceType: credentialDeviceType,
      name:
        chosenName ||
        defaultPasskeyName({
          aaguid: knownAaguid,
          userAgent: this.c.req.header("user-agent"),
        }),
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      transports: (credential.transports ?? [])
        .filter(isTransport)
        .slice(0, TRANSPORTS.length),
      userId,
      webauthnUserId: challenge.webauthnUserId,
    });

    if (!passkey) throw new PasskeyError("already_registered", 409);

    await this.c
      .get("events")
      .emit("user.passkey.created", { passkeyId: passkey.id, userId });

    return toPublicPasskey(passkey);
  }

  get store(): PasskeyStore {
    return drizzlePasskeyStore(this.c.get("db"));
  }
}
