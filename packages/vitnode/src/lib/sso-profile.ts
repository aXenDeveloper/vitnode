export const SSO_PROFILE_FIELDS = ["avatar", "firstName", "lastName"] as const;

export type SsoProfileField = (typeof SSO_PROFILE_FIELDS)[number];

export const SSO_CONNECTION_INTENTS = ["link", "import", "sync"] as const;

export type SsoConnectionIntent = (typeof SSO_CONNECTION_INTENTS)[number];

export const SSO_OPERATION_INTENTS = [
  ...SSO_CONNECTION_INTENTS,
  "preview",
] as const;

export type SsoOperationIntent = (typeof SSO_OPERATION_INTENTS)[number];

export const SSO_CONNECTION_STATE_PREFIX: Record<SsoConnectionIntent, string> =
  {
    import: "ci_",
    link: "cl_",
    sync: "cs_",
  };

export const ssoConnectionIntentOfState = (
  state: string | undefined,
): null | SsoConnectionIntent => {
  if (!state) return null;

  return (
    SSO_CONNECTION_INTENTS.find(intent =>
      state.startsWith(SSO_CONNECTION_STATE_PREFIX[intent]),
    ) ?? null
  );
};
