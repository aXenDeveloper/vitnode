import { z } from "zod";

import type { SSOApiPlugin } from "@/api/models/sso";

import {
  basicClientAuth,
  bearerAuth,
  claimString,
  formPost,
  requestSsoProviderJson,
  requireSsoOption,
} from "@/api/lib/sso-protocol";
import { getRedirectUri } from "@/api/models/sso";

import { PAYPAL_ICON } from "./icons";

/** Which PayPal you sign in against. Sandbox credentials only work with `"sandbox"`. */
export type PayPalEnvironment = "live" | "sandbox";

/** Where each PayPal environment answers. */
export const PAYPAL_ENDPOINTS: Record<
  PayPalEnvironment,
  { api: string; web: string }
> = {
  live: { api: "https://api-m.paypal.com", web: "https://www.paypal.com" },
  sandbox: {
    api: "https://api-m.sandbox.paypal.com",
    web: "https://www.sandbox.paypal.com",
  },
};

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userInfoSchema = z.object({
  email: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
  emails: z
    .array(
      z.object({
        confirmed: z.boolean().optional(),
        primary: z.boolean().optional(),
        value: z.string(),
      }),
    )
    .optional(),
  family_name: z.string().nullable().optional(),
  given_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  user_id: z.string().min(1).max(255),
});

/** The primary address and whether PayPal confirmed it. */
const emailOf = (
  info: z.infer<typeof userInfoSchema>,
): { email: null | string; verified: boolean } => {
  const primary =
    info.emails?.find(one => one.primary) ?? info.emails?.at(0) ?? null;
  if (primary) {
    return {
      email: claimString(primary.value),
      verified: primary.confirmed === true,
    };
  }

  const email = claimString(info.email);

  return { email, verified: email !== null && info.email_verified === true };
};

/**
 * Log in with PayPal: an SSO adapter for the API config's
 * `authorization.ssoAdapters`. Signs people in with their PayPal account -
 * it takes no payments and needs no payment permissions. Requests
 * `openid email profile` and redirects back to `login/sso/paypal` under
 * `VITNODE_WEB_URL`, which PayPal requires to be HTTPS.
 *
 * `environment` is required: sandbox and live have separate apps,
 * credentials and endpoints. The primary email is trusted only when PayPal
 * marks it confirmed; otherwise a new member confirms an address in VitNode
 * by email link. Supplies first and last name for profile sync.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * import { PayPalSSOApiPlugin } from "@vitnode/core/api/adapters/sso/paypal";
 *
 * buildApiConfig({
 *   authorization: {
 *     ssoAdapters: [
 *       PayPalSSOApiPlugin({
 *         clientId: process.env.PAYPAL_CLIENT_ID,
 *         clientSecret: process.env.PAYPAL_CLIENT_SECRET,
 *         environment: "sandbox",
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const PayPalSSOApiPlugin = ({
  clientId,
  clientSecret,
  environment,
}: {
  /** The REST app's Client ID for `environment`. `undefined` still registers the button, but signing in throws until it is set. */
  clientId: string | undefined;
  /** The REST app's Secret for `environment`. Needed to exchange the code. */
  clientSecret: string | undefined;
  /** `"sandbox"` for test accounts, `"live"` for real ones. No default, on purpose. */
  environment: PayPalEnvironment;
}): SSOApiPlugin => {
  const id = "paypal";
  const redirectUri = getRedirectUri(id);
  const endpoints = PAYPAL_ENDPOINTS[environment] as
    | (typeof PAYPAL_ENDPOINTS)[PayPalEnvironment]
    | undefined;
  if (!endpoints) {
    throw new Error(
      `Invalid PayPal environment "${environment}" - use "sandbox" or "live"`,
    );
  }

  return {
    brandColor: "#003087",
    icon: PAYPAL_ICON,
    id,
    name: "PayPal",
    profileFields: ["firstName", "lastName"],
    getUrl: ({ state }) => {
      const url = new URL(`${endpoints.web}/signin/authorize`);
      url.searchParams.set("flowEntry", "static");
      url.searchParams.set(
        "client_id",
        requireSsoOption(clientId, "PayPal", "client ID"),
      );
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);

      return url.toString();
    },
    fetchToken: async code =>
      await requestSsoProviderJson({
        init: formPost(
          { code, grant_type: "authorization_code" },
          basicClientAuth(
            requireSsoOption(clientId, "PayPal", "client ID"),
            requireSsoOption(clientSecret, "PayPal", "client secret"),
          ),
        ),
        schema: tokenSchema,
        step: "token",
        url: `${endpoints.api}/v1/oauth2/token`,
      }),
    fetchUser: async ({ access_token }) => {
      const url = new URL(`${endpoints.api}/v1/identity/oauth2/userinfo`);
      url.searchParams.set("schema", "paypalv1.1");
      const info = await requestSsoProviderJson({
        init: { headers: bearerAuth(access_token) },
        schema: userInfoSchema,
        step: "profile",
        url,
      });
      const { email, verified } = emailOf(info);

      return {
        email,
        emailVerified: email !== null && verified,
        firstName: info.given_name ?? null,
        id: info.user_id,
        lastName: info.family_name ?? null,
        username: info.name ?? null,
      };
    },
  };
};
