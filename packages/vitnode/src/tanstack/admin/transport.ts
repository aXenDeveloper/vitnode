import type { AdminSessionReadResult } from "./session-api";

export interface AdminTransport {
  readAdminSession: () => Promise<AdminSessionReadResult>;
}

let registered: AdminTransport | undefined;

export const ADMIN_TRANSPORT_MISSING =
  "No admin transport is registered. Call setAdminTransport() from a module the application always loads - the router entry - before any admin route runs.";

export const setAdminTransport = (transport: AdminTransport): void => {
  registered = transport;
};

export const adminTransport = (): AdminTransport => {
  if (!registered) throw new Error(ADMIN_TRANSPORT_MISSING);

  return registered;
};

/** Whether an application has registered a transport yet. For tests. */
export const hasAdminTransport = (): boolean => registered !== undefined;
