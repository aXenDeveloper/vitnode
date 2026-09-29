import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import type { PasskeyCeremonyFailure } from "../../passkeys/webauthn";
import type { Passkey } from "./passkeys-query";

import { createPasskeyInBrowser } from "../../passkeys/webauthn";

export type AddPasskeyFailure =
  | "admin_session_required"
  | "expired"
  | "server_error"
  | "unavailable"
  | PasskeyCeremonyFailure;

export type AddPasskeyResult =
  { failure: AddPasskeyFailure; ok: false } | { ok: true; passkey: Passkey };

export type AddPasskey = () => Promise<AddPasskeyResult>;

export type RenamePasskeyResult =
  { failure: "not_found" | "server_error"; ok: false } | { ok: true };

export type RenamePasskey = (args: {
  id: number;
  name: string;
}) => Promise<RenamePasskeyResult>;

export type DeletePasskeyResult =
  | {
      failure: "last_recovery_method" | "not_found" | "server_error";
      ok: false;
    }
  | { ok: true };

export type DeletePasskey = (args: {
  id: number;
}) => Promise<DeletePasskeyResult>;

const CREDENTIALS = { credentials: "include" } as const;

const failed = <Failure>(failure: Failure) => ({ failure, ok: false as const });

export const addPasskeyInBrowser: AddPasskey = async () => {
  try {
    const optionsResponse = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "users/passkeys",
      options: CREDENTIALS,
      path: "/register/options",
    });

    if (optionsResponse.status === 404) return failed("unavailable");
    if (optionsResponse.status === 403) {
      return failed("admin_session_required");
    }
    if (optionsResponse.status !== 200) return failed("server_error");

    const options = await optionsResponse.json();
    if (!("challenge" in options)) return failed("server_error");

    const ceremony = await createPasskeyInBrowser(options);
    if (!ceremony.ok) return failed(ceremony.failure);

    const verifyResponse = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { response: ceremony.response } },
      method: "post",
      module: "users/passkeys",
      options: CREDENTIALS,
      path: "/register",
    });

    if (verifyResponse.status === 409) return failed("already_registered");
    if (verifyResponse.status === 403) {
      return failed("admin_session_required");
    }
    if (verifyResponse.status === 400) return failed("expired");
    if (verifyResponse.status !== 201) return failed("server_error");

    const body = await verifyResponse.json();
    if (!("passkey" in body)) return failed("server_error");

    return { ok: true, passkey: body.passkey };
  } catch {
    return failed("server_error");
  }
};

export const renamePasskeyInBrowser: RenamePasskey = async ({ id, name }) => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { body: { name }, params: { id: String(id) } },
      method: "patch",
      module: "users/passkeys",
      options: CREDENTIALS,
      path: "/{id}",
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 404) return failed("not_found");

    return failed("server_error");
  } catch {
    return failed("server_error");
  }
};

export const deletePasskeyInBrowser: DeletePasskey = async ({ id }) => {
  try {
    const response = await fetcherClient({
      plugin: CONFIG_PLUGIN.pluginId,
      args: { params: { id: String(id) } },
      method: "delete",
      module: "users/passkeys",
      options: CREDENTIALS,
      path: "/{id}",
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 404) return failed("not_found");
    if (response.status === 409) return failed("last_recovery_method");

    return failed("server_error");
  } catch {
    return failed("server_error");
  }
};
