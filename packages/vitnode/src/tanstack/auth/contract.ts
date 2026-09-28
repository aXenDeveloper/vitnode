import { z } from "zod";

import type {
  PasskeyErrorCode,
  zodPasskeyAuthenticationOptionsSchema,
  zodPasskeyAuthenticationResponseSchema,
} from "@/api/modules/users/passkeys/schema";

import { RATE_LIMIT_STATUS } from "@/lib/fetcher/rate-limit";
import { signUpConflictReason } from "@/views/auth/sign-up/form/schema";

export const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

export const signInInputSchema = z.object({
  email: z.email().toLowerCase(),
  isAdmin: z.boolean().optional(),
  password: z.string().min(1).max(1024),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

/** Which session to end. Mirrors the API's sign-out body. */
export const signOutInputSchema = z.object({
  isAdmin: z.boolean().optional(),
});

export type SignOutInput = z.infer<typeof signOutInputSchema>;

/** Which provider to start a sign-in with. */
export const ssoStartInputSchema = z.object({
  providerId: providerIdSchema,
});

export type SsoStartInput = z.infer<typeof ssoStartInputSchema>;

export const ssoCallbackInputSchema = z.object({
  code: z.string().min(1).max(2048),
  providerId: providerIdSchema,
  state: z.string().min(1).max(2048),
});

export type SsoCallbackInput = z.infer<typeof ssoCallbackInputSchema>;

export type SignInResult =
  { ok: false; reason: "access_denied" | "server_error" } | { ok: true };

export type PasskeySignInOptions = z.infer<
  typeof zodPasskeyAuthenticationOptionsSchema
>;

export type PasskeySignInOptionsBody =
  PasskeySignInOptions | { error: PasskeyErrorCode };

export interface PasskeySignInInput {
  response: z.input<typeof zodPasskeyAuthenticationResponseSchema>;
}

export type PasskeySignInStartResult =
  | { ok: false; reason: "server_error" | "unavailable" }
  | { ok: true; options: PasskeySignInOptions };

export type PasskeySignInResult =
  | { ok: false; reason: "access_denied" | "expired" | "server_error" }
  | { ok: true };

export type AdminPasskeySignInResult =
  | {
      ok: false;
      reason: "access_denied" | "expired" | "not_staff" | "server_error";
    }
  | { ok: true };

export type SignOutResult =
  { ok: false; reason: "server_error" } | { ok: true };

export type SsoStartResult =
  | { ok: false; reason: "server_error" | "unknown_provider" }
  | { ok: true; url: string };

export const ssoLinkOfferSchema = z.object({
  email: z.string().min(3).max(320),
  hasPassword: z.boolean(),
  linkToken: z.string().min(16).max(2048),
});

export type SsoLinkOffer = z.infer<typeof ssoLinkOfferSchema>;

export type CompleteSsoResult =
  | { offer?: SsoLinkOffer; ok: false; reason: "email_exists" }
  | {
      ok: false;
      reason: "invalid_state" | "server_error" | "unknown_provider";
    }
  | { ok: true };

export const ssoLinkInputSchema = z.object({
  password: z.string().min(1).max(1024),
  providerId: providerIdSchema,
  token: z.string().min(16).max(2048),
});

export type SsoLinkInput = z.infer<typeof ssoLinkInputSchema>;

export type SsoLinkResult =
  | {
      ok: false;
      reason:
        | "access_denied"
        | "already_linked"
        | "invalid_token"
        | "server_error"
        | "unknown_provider";
    }
  | { ok: true };

export { shouldRefreshSessionAfterSignUp } from "./sign-up-session";

export const isUsableSessionStatus = (status: number): boolean =>
  status === 200;

export const SESSION_UNAVAILABLE = "The session could not be read.";

export const signInResultFromStatus = (status: number): SignInResult => {
  if (status === 201) return { ok: true };
  if (status === 403) return { ok: false, reason: "access_denied" };

  return { ok: false, reason: "server_error" };
};

export const passkeySignInStartResultFromStatus = (
  status: number,
  body?: PasskeySignInOptionsBody,
): PasskeySignInStartResult => {
  if (status === 404) return { ok: false, reason: "unavailable" };
  if (status !== 200 || !body || !("challenge" in body)) {
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, options: body };
};

export const passkeySignInResultFromStatus = (
  status: number,
): PasskeySignInResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "expired" };
  if (status === 403) return { ok: false, reason: "access_denied" };

  return { ok: false, reason: "server_error" };
};

const notStaffBodySchema = z.object({ error: z.literal("not_staff") });

export const adminPasskeySignInResultFromStatus = (
  status: number,
  body?: unknown,
): AdminPasskeySignInResult => {
  if (status === 403 && notStaffBodySchema.safeParse(body).success) {
    return { ok: false, reason: "not_staff" };
  }

  return passkeySignInResultFromStatus(status);
};

export const signOutResultFromStatus = (status: number): SignOutResult =>
  status === 200 ? { ok: true } : { ok: false, reason: "server_error" };

export const isProviderRedirectUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

/**
 * The provider's authorization URL, or why there is none. `404` is the API's
 * answer for a provider this install does not have configured.
 */
export const ssoStartResultFromStatus = (
  status: number,
  url: unknown,
): SsoStartResult => {
  if (status === 404) return { ok: false, reason: "unknown_provider" };
  if (status !== 200 || !isProviderRedirectUrl(url)) {
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, url };
};

export const completeSsoResultFromStatus = (
  status: number,
  body?: unknown,
): CompleteSsoResult => {
  if (status === 200) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid_state" };
  if (status === 404) return { ok: false, reason: "unknown_provider" };
  if (status === 409) {
    const offer = ssoLinkOfferSchema.safeParse(body);

    return offer.success
      ? { offer: offer.data, ok: false, reason: "email_exists" }
      : { ok: false, reason: "email_exists" };
  }

  return { ok: false, reason: "server_error" };
};

export const ssoLinkResultFromStatus = (status: number): SsoLinkResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid_token" };
  if (status === 403) return { ok: false, reason: "access_denied" };
  if (status === 404) return { ok: false, reason: "unknown_provider" };
  if (status === 409) return { ok: false, reason: "already_linked" };

  return { ok: false, reason: "server_error" };
};

export type ParsedSsoCallback =
  | {
      ok: false;
      reason: "access_denied" | "invalid_callback" | "provider_error";
    }
  | { ok: true; params: SsoCallbackInput };

const ssoCallbackQuerySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  state: z.string().optional(),
});

/** `URLSearchParams` and a plain search object, as one shape to validate. */
const asQueryRecord = (query: unknown): unknown =>
  query instanceof URLSearchParams ? Object.fromEntries(query) : query;

export const parseSsoCallback = ({
  providerId,
  query,
}: {
  providerId: unknown;
  query: unknown;
}): ParsedSsoCallback => {
  const parsedQuery = ssoCallbackQuerySchema.safeParse(asQueryRecord(query));
  const { code, error, state } = parsedQuery.success ? parsedQuery.data : {};

  if (error !== undefined && error !== "") {
    return {
      ok: false,
      reason: error === "access_denied" ? "access_denied" : "provider_error",
    };
  }

  const params = ssoCallbackInputSchema.safeParse({ code, providerId, state });
  if (!params.success) return { ok: false, reason: "invalid_callback" };

  return { ok: true, params: params.data };
};

const captchaTokenSchema = z.string().max(8192).default("");

export const signUpInputSchema = z.object({
  captchaToken: captchaTokenSchema,
  email: z.email().toLowerCase(),
  name: z
    .string()
    .min(3)
    .max(32)
    .regex(/^(?!.* {2})[\p{L}\p{N}._@ -]*$/u),
  newsletter: z.boolean().optional(),
  password: z.string().min(8).max(1024),
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;

const signUpSuccessSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
});

/**
 * What a reset request accepts. One address and the captcha the route requires.
 */
export const passwordResetRequestInputSchema = z.object({
  captchaToken: captchaTokenSchema,
  email: z.email().toLowerCase(),
});

export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestInputSchema
>;

export const changePasswordInputSchema = z.object({
  password: z.string().min(8).max(1024),
  token: z
    .string()
    .min(16)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/),
  userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export type SignUpResult =
  | { email: string; emailVerified: boolean; ok: true }
  | {
      ok: false;
      reason:
        | "conflict"
        | "email_exists"
        | "invalid"
        | "name_exists"
        | "rate_limited"
        | "server_error";
    };

export type PasswordResetRequestResult =
  | { ok: false; reason: "invalid" | "rate_limited" | "server_error" }
  | { ok: true };

export type ChangePasswordResult =
  | { ok: false; reason: "invalid_token" | "rate_limited" | "server_error" }
  | { ok: true };

export const signUpResultFromStatus = (
  status: number,
  { body, conflict }: { body?: unknown; conflict?: string } = {},
): SignUpResult => {
  if (status === 201) {
    const parsed = signUpSuccessSchema.safeParse(body);

    if (!parsed.success) return { ok: false, reason: "server_error" };

    return {
      email: parsed.data.email,
      emailVerified: parsed.data.emailVerified,
      ok: true,
    };
  }

  if (status === 400) return { ok: false, reason: "invalid" };
  if (status === 409) {
    const reason = signUpConflictReason(conflict ?? "");

    return {
      ok: false,
      reason: reason === "unknown" ? "conflict" : reason,
    };
  }
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

export const passwordResetRequestResultFromStatus = (
  status: number,
): PasswordResetRequestResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid" };
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

export const changePasswordResultFromStatus = (
  status: number,
): ChangePasswordResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid_token" };
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

export { shouldSaveApiCookies } from "@/lib/fetcher/set-cookie";
