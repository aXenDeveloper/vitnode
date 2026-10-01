import type {
  SsoConnectionProvider,
  SsoSignInSummary,
} from "./sso-connections-query";

export type SsoSignInHint = "connect_other" | "passkey" | "password";

export const ssoSignInHints = ({
  providerId,
  providers,
  signIn,
}: {
  providerId: string;
  providers: SsoConnectionProvider[];
  signIn: SsoSignInSummary;
}): SsoSignInHint[] => [
  ...(signIn.passwordEnabled && !signIn.hasPassword
    ? (["password"] as const)
    : []),
  ...(signIn.passkeysEnabled ? (["passkey"] as const) : []),
  ...(providers.some(
    provider =>
      provider.id !== providerId && provider.available && !provider.connection,
  )
    ? (["connect_other"] as const)
    : []),
];
