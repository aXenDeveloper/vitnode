import type { SsoConnectionIntent, SsoProfileField } from "@/lib/sso-profile";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import type { SsoProfileSources } from "./sso-connections-query";

const CREDENTIALS = { credentials: "include" } as const;

const failed = <Failure>(failure: Failure) => ({ failure, ok: false as const });

const errorCodeOf = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
};

const providerParam = (providerId: string) => ({
  providerId: encodeURIComponent(providerId),
});

export type StartSsoConnectionFailure =
  | "invalid_fields"
  | "not_connected"
  | "nothing_to_sync"
  | "provider_already_connected"
  | "provider_not_found"
  | "server_error";

export type StartSsoConnectionResult =
  | { failure: StartSsoConnectionFailure; ok: false }
  | { ok: true; url: string };

export type StartSsoConnection = (args: {
  fields?: SsoProfileField[];
  intent: SsoConnectionIntent;
  providerId: string;
}) => Promise<StartSsoConnectionResult>;

const START_FAILURES: readonly StartSsoConnectionFailure[] = [
  "invalid_fields",
  "not_connected",
  "nothing_to_sync",
  "provider_already_connected",
  "provider_not_found",
];

export const startSsoConnectionInBrowser: StartSsoConnection = async ({
  fields,
  intent,
  providerId,
}) => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { fields, intent }, params: providerParam(providerId) },
      method: "post",
      module: "users/sso/connections",
      options: CREDENTIALS,
      path: "/{providerId}/authorize",
    });

    if (response.status === 200) {
      const body = await response.json();
      if ("url" in body) return { ok: true, url: body.url };
    }

    const code = await errorCodeOf(response);
    const known = START_FAILURES.find(failure => failure === code);

    return failed(known ?? "server_error");
  } catch {
    return failed("server_error");
  }
};

export type CompleteSsoConnectionFailure =
  | "account_mismatch"
  | "account_taken"
  | "invalid_state"
  | "not_connected"
  | "provider_already_connected"
  | "provider_error"
  | "server_error"
  | "unauthenticated";

export type CompleteSsoConnectionResult =
  | { failure: CompleteSsoConnectionFailure; ok: false }
  | {
      intent: SsoConnectionIntent;
      ok: true;
      results?: Partial<Record<SsoProfileField, SsoFieldOutcome>>;
    };

const COMPLETE_FAILURES: readonly CompleteSsoConnectionFailure[] = [
  "account_mismatch",
  "account_taken",
  "invalid_state",
  "not_connected",
  "provider_already_connected",
  "provider_error",
];

export const completeSsoConnectionInBrowser = async ({
  code,
  providerId,
  state,
}: {
  code: string;
  providerId: string;
  state: string;
}): Promise<CompleteSsoConnectionResult> => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { code, state }, params: providerParam(providerId) },
      method: "post",
      module: "users/sso/connections",
      options: CREDENTIALS,
      path: "/{providerId}/callback",
    });

    if (response.status === 200) {
      const body = await response.json();
      if ("intent" in body) {
        return { intent: body.intent, ok: true, results: body.results };
      }
    }
    if (response.status === 401) return failed("unauthenticated");

    const errorCode = await errorCodeOf(response);

    return failed(
      COMPLETE_FAILURES.find(failure => failure === errorCode) ??
        "server_error",
    );
  } catch {
    return failed("server_error");
  }
};

export type DisconnectSsoConnectionResult =
  | {
      failure: "last_sign_in_method" | "not_connected" | "server_error";
      ok: false;
    }
  | { ok: true };

export type DisconnectSsoConnection = (args: {
  providerId: string;
}) => Promise<DisconnectSsoConnectionResult>;

export const disconnectSsoConnectionInBrowser: DisconnectSsoConnection =
  async ({ providerId }) => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: providerParam(providerId) },
        method: "delete",
        module: "users/sso/connections",
        options: CREDENTIALS,
        path: "/{providerId}",
      });

      if (response.status === 200) return { ok: true };
      if (response.status === 404) return failed("not_connected");
      if (response.status === 409) return failed("last_sign_in_method");

      return failed("server_error");
    } catch {
      return failed("server_error");
    }
  };

export type SaveSsoPreferencesResult =
  | { failure: "invalid_source" | "server_error"; ok: false }
  | { ok: true };

export type SaveSsoPreferences = (args: {
  sources: Partial<SsoProfileSources>;
  sync: Record<string, boolean>;
}) => Promise<SaveSsoPreferencesResult>;

export const saveSsoPreferencesInBrowser: SaveSsoPreferences = async ({
  sources,
  sync,
}) => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { sources, sync } },
      method: "put",
      module: "users/sso/connections",
      options: CREDENTIALS,
      path: "/preferences",
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 400 || response.status === 409) {
      return failed("invalid_source");
    }

    return failed("server_error");
  } catch {
    return failed("server_error");
  }
};

export type SsoFieldOutcome =
  | "failed"
  | "missing"
  | "not_allowed"
  | "unchanged"
  | "updated";

export type ApplySsoImportResult =
  | {
      failure: "account_mismatch" | "preview_not_found" | "server_error";
      ok: false;
    }
  | {
      manualFields: SsoProfileField[];
      ok: true;
      results: Partial<Record<SsoProfileField, SsoFieldOutcome>>;
    };

export type ApplySsoImport = (args: {
  fields: SsoProfileField[];
  providerId: string;
}) => Promise<ApplySsoImportResult>;

export const applySsoImportInBrowser: ApplySsoImport = async ({
  fields,
  providerId,
}) => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { fields }, params: providerParam(providerId) },
      method: "post",
      module: "users/sso/connections",
      options: CREDENTIALS,
      path: "/{providerId}/import",
    });

    if (response.status === 200) {
      const body = await response.json();
      if ("results" in body) {
        return {
          manualFields: body.manualFields,
          ok: true,
          results: body.results,
        };
      }
    }
    if (response.status === 404) return failed("preview_not_found");
    if (response.status === 409) return failed("account_mismatch");

    return failed("server_error");
  } catch {
    return failed("server_error");
  }
};

export type DiscardSsoImport = (args: { providerId: string }) => Promise<void>;

export const discardSsoImportInBrowser: DiscardSsoImport = async ({
  providerId,
}) => {
  try {
    await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { params: providerParam(providerId) },
      method: "delete",
      module: "users/sso/connections",
      options: CREDENTIALS,
      path: "/{providerId}/import",
    });
  } catch {
    return;
  }
};
