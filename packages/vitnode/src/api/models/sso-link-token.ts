import { z } from "zod";

import { signPayload, verifySignedPayload } from "@/lib/api/signed-token";

export const SSO_LINK_SECRET_NAME = "sso_link";

export const SSO_LINK_TOKEN_TTL_MS = 10 * 60_000;

const zodSsoLinkTokenPayload = z.object({
  aud: z.literal("sso-link"),
  e: z.string().min(3),
  exp: z.number().int().positive(),
  p: z.string().min(1),
  pe: z.string().nullable().optional(),
  s: z.string().min(1),
  u: z.number().int().positive(),
});

export interface SsoLinkOffer {
  /** The address the visitor proved they own - from the provider, or confirmed with a code. */
  email: string;
  providerAccountId: string;
  /** The address the provider itself shared, stored on the connection. `null` when it shared none. Defaults to `email`. */
  providerEmail?: null | string;
  providerId: string;
  userId: number;
}

export const createSsoLinkToken = ({
  now = new Date(),
  offer,
  secret,
}: {
  now?: Date;
  offer: SsoLinkOffer;
  secret: string;
}): { expiresAt: Date; token: string } => {
  const expiresAt = new Date(now.getTime() + SSO_LINK_TOKEN_TTL_MS);

  return {
    expiresAt,
    token: signPayload(secret, {
      aud: "sso-link",
      e: offer.email,
      exp: Math.floor(expiresAt.getTime() / 1000),
      p: offer.providerId,
      ...(offer.providerEmail === undefined ||
      offer.providerEmail === offer.email
        ? {}
        : { pe: offer.providerEmail }),
      s: offer.providerAccountId,
      u: offer.userId,
    }),
  };
};

export const verifySsoLinkToken = ({
  now = new Date(),
  providerId,
  secret,
  token,
}: {
  now?: Date;
  providerId: string;
  secret: string;
  token: string;
}): null | SsoLinkOffer => {
  const payload = verifySignedPayload(secret, token, zodSsoLinkTokenPayload);
  if (!payload) return null;

  if (payload.p !== providerId) return null;
  if (payload.exp * 1000 <= now.getTime()) return null;

  return {
    email: payload.e,
    providerAccountId: payload.s,
    providerEmail: payload.pe === undefined ? payload.e : payload.pe,
    providerId: payload.p,
    userId: payload.u,
  };
};
