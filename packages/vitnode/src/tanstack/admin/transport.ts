import type { AdminSessionReadResult } from "./session-api";
import type { AdminSessionReadOptions } from "./session-read";

import { defaultAdminTransport } from "./default-transport";

export interface AdminTransport {
  readAdminSession: (
    options?: AdminSessionReadOptions,
  ) => Promise<AdminSessionReadResult>;
}

let registered: AdminTransport | undefined;

export const setAdminTransport = (transport: AdminTransport): void => {
  registered = transport;
};

/** Drops a registered override, so the built-in default answers again. */
export const resetAdminTransport = (): void => {
  registered = undefined;
};

export const adminTransport = (): AdminTransport =>
  registered ?? defaultAdminTransport;

/** Whether an application registered a transport of its own. */
export const hasAdminTransport = (): boolean => registered !== undefined;
