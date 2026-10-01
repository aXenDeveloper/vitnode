import type { SsoProfileField } from "@/lib/sso-profile";

import type {
  CompleteSsoConnectionFailure,
  CompleteSsoConnectionResult,
  SsoFieldOutcome,
} from "./sso-connections-mutations";

export interface SsoConnectionCallbackSearch {
  code?: string;
  error?: string;
  state?: string;
}

export interface SsoConnectionCallbackTarget {
  connected?: string;
  error?: "access_denied" | CompleteSsoConnectionFailure;
  import?: string;
  provider?: string;
  results?: Partial<Record<SsoProfileField, SsoFieldOutcome>>;
  synced?: string;
}

export const ssoConnectionCallbackTarget = async ({
  complete,
  providerId,
  search,
}: {
  complete: (args: {
    code: string;
    providerId: string;
    state: string;
  }) => Promise<CompleteSsoConnectionResult>;
  providerId: string;
  search: SsoConnectionCallbackSearch;
}): Promise<SsoConnectionCallbackTarget> => {
  if (search.error) {
    return {
      error:
        search.error === "access_denied" ? "access_denied" : "provider_error",
      provider: providerId,
    };
  }

  if (!(search.code && search.state)) {
    return { error: "invalid_state", provider: providerId };
  }

  const result = await complete({
    code: search.code,
    providerId,
    state: search.state,
  });

  if (!result.ok) return { error: result.failure, provider: providerId };

  if (result.intent === "link") return { connected: providerId };
  if (result.intent === "sync") {
    return { results: result.results ?? {}, synced: providerId };
  }

  return { import: providerId };
};
