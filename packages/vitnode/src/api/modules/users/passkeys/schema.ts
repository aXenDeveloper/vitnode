import { z } from "@hono/zod-openapi";

import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/passkey";

const base64Url = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[A-Za-z0-9_-]*={0,2}$/);

const credentialDescriptor = z.object({
  id: z.string(),
  transports: z.array(z.string()).optional(),
  type: z.string(),
});

const userVerification = z.enum(["discouraged", "preferred", "required"]);

const authenticatorAttachment = z.enum(["cross-platform", "platform"]);

export const zodPasskeyRegistrationOptionsSchema = z.object({
  attestation: z.enum(["direct", "enterprise", "indirect", "none"]).optional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: authenticatorAttachment.optional(),
      requireResidentKey: z.boolean().optional(),
      residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
      userVerification: userVerification.optional(),
    })
    .optional(),
  challenge: z.string(),
  excludeCredentials: z.array(credentialDescriptor).optional(),
  pubKeyCredParams: z.array(
    z.object({ alg: z.number(), type: z.literal("public-key") }),
  ),
  rp: z.object({ id: z.string().optional(), name: z.string() }),
  timeout: z.number().optional(),
  user: z.object({
    displayName: z.string(),
    id: z.string(),
    name: z.string(),
  }),
});

export const zodPasskeyAuthenticationOptionsSchema = z.object({
  allowCredentials: z.array(credentialDescriptor).optional(),
  challenge: z.string(),
  rpId: z.string().optional(),
  timeout: z.number().optional(),
  userVerification: userVerification.optional(),
});

const CREDENTIAL_ID_MAX = 1024;
const PAYLOAD_MAX = 32_768;

const clientExtensionResults = z.object({
  credProps: z.object({ rk: z.boolean().optional() }).optional(),
});

export const zodPasskeyRegistrationResponseSchema = z.object({
  authenticatorAttachment: authenticatorAttachment.optional(),
  clientExtensionResults,
  id: base64Url(CREDENTIAL_ID_MAX),
  rawId: base64Url(CREDENTIAL_ID_MAX),
  response: z.object({
    attestationObject: base64Url(PAYLOAD_MAX),
    authenticatorData: base64Url(PAYLOAD_MAX).optional(),
    clientDataJSON: base64Url(PAYLOAD_MAX),
    publicKey: base64Url(PAYLOAD_MAX).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    transports: z.array(z.string().max(32)).max(16).optional(),
  }),
  type: z.literal("public-key"),
});

export const zodPasskeyAuthenticationResponseSchema = z.object({
  authenticatorAttachment: authenticatorAttachment.optional(),
  clientExtensionResults,
  id: base64Url(CREDENTIAL_ID_MAX),
  rawId: base64Url(CREDENTIAL_ID_MAX),
  response: z.object({
    authenticatorData: base64Url(PAYLOAD_MAX),
    clientDataJSON: base64Url(PAYLOAD_MAX),
    signature: base64Url(PAYLOAD_MAX),
    userHandle: base64Url(512).optional(),
  }),
  type: z.literal("public-key"),
});

export const zodPasskeyNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PASSKEY_NAME_MAX_LENGTH)
  .openapi({ example: "MacBook Touch ID" });

export const zodPasskeySchema = z.object({
  backedUp: z.boolean(),
  createdAt: z.date(),
  deviceType: z.enum(["multiDevice", "singleDevice"]),
  id: z.number(),
  lastUsedAt: z.date().nullable(),
  name: z.string(),
  transports: z.array(z.string()),
});

export const zodPasskeyErrorSchema = z.object({
  error: z.enum([
    "admin_session_required",
    "already_registered",
    "invalid_challenge",
    "last_recovery_method",
    "not_found",
    "not_staff",
    "passkeys_disabled",
    "verification_failed",
  ]),
});

export type PasskeyErrorCode = z.infer<typeof zodPasskeyErrorSchema>["error"];

export const passkeyErrorResponse = (description: string) => ({
  content: {
    "application/json": {
      schema: zodPasskeyErrorSchema,
    },
  },
  description,
});

export const PASSKEY_ERROR_RESPONSES = {
  400: passkeyErrorResponse("The challenge or the credential was rejected"),
  403: passkeyErrorResponse(
    "The passkey could not be verified, or the account may not do this",
  ),
  404: passkeyErrorResponse("Passkeys are disabled or the passkey is unknown"),
  409: passkeyErrorResponse("The request conflicts with the account's state"),
};

export const zodPasskeyIdParam = z
  .string()
  .regex(/^\d{1,9}$/, "Must be a whole number.")
  .openapi({ example: "1" });
