import { z } from "@hono/zod-openapi";

import type { SsoConnectionErrorCode } from "@/api/models/sso-connection";

import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

const ERROR_CODES = [
  "account_mismatch",
  "account_taken",
  "invalid_fields",
  "invalid_source",
  "invalid_state",
  "last_sign_in_method",
  "not_connected",
  "nothing_to_sync",
  "preview_not_found",
  "provider_already_connected",
  "provider_error",
  "provider_not_found",
] as const satisfies readonly SsoConnectionErrorCode[];

export const zodSsoConnectionErrorSchema = z.object({
  error: z.enum(ERROR_CODES),
});

const errorResponse = (description: string) => ({
  content: {
    "application/json": {
      schema: zodSsoConnectionErrorSchema,
    },
  },
  description,
});

export const SSO_CONNECTION_ERROR_RESPONSES = {
  400: errorResponse("The request or its state was rejected"),
  401: { description: "Not signed in" },
  404: errorResponse("The provider, connection or import is unknown"),
  409: errorResponse("The request conflicts with the account's connections"),
  502: errorResponse("The provider did not answer as expected"),
};

export const zodSsoProviderIdParam = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w-]+$/)
  .openapi({ example: "google" });

export const zodSsoProfileField = z.enum(SSO_PROFILE_FIELDS);

export const zodSsoConnectionsOverview = z.object({
  providers: z.array(
    z.object({
      available: z.boolean(),
      connection: z
        .object({
          accountLabel: z.string().nullable(),
          connectedAt: z.date(),
          email: z.string().nullable(),
          syncOnSignIn: z.boolean(),
        })
        .nullable(),
      icon: z.string().nullable(),
      id: z.string(),
      name: z.string(),
      profileFields: z.array(zodSsoProfileField),
    }),
  ),
  signIn: z.object({
    hasPassword: z.boolean(),
    passkeys: z.number(),
    passkeysEnabled: z.boolean(),
    passwordEnabled: z.boolean(),
  }),
  sources: z.object({
    avatar: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }),
});

export const zodSsoImportPreview = z.object({
  expiresAt: z.date(),
  fields: z.array(
    z.object({
      allowed: z.boolean(),
      current: z.string().nullable(),
      field: zodSsoProfileField,
      incoming: z.string().nullable(),
      source: z.string().nullable(),
    }),
  ),
});

const zodFieldOutcome = z.enum([
  "failed",
  "missing",
  "not_allowed",
  "unchanged",
  "updated",
]);

export const zodSsoFieldOutcomes = z.object({
  avatar: zodFieldOutcome.optional(),
  firstName: zodFieldOutcome.optional(),
  lastName: zodFieldOutcome.optional(),
});

export const zodSsoImportResult = z.object({
  manualFields: z.array(zodSsoProfileField),
  results: zodSsoFieldOutcomes,
});
