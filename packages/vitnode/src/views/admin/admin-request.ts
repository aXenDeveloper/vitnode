import type { BaseBuildModuleReturn } from "@/api/lib/module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule } from "@/lib/fetcher-client";

export const adminModuleRef = <T extends BaseBuildModuleReturn>(): T =>
  clientModule<T>(CONFIG_PLUGIN.pluginId);

/** The `name` every {@link AdminRequestError} carries. See below. */
const ADMIN_REQUEST_ERROR = "AdminRequestError";

export class AdminRequestError extends Error {
  constructor(status: number, screen: string, detail?: string) {
    super(
      `The admin API answered ${status} for ${screen}${detail ? ` (${detail})` : ""}.`,
    );
    this.name = ADMIN_REQUEST_ERROR;
    this.screen = screen;
    this.status = status;
  }

  /** Which screen was asking - the first question anyone reading a log has. */
  readonly screen: string;

  readonly status: number;
}

export const isAdminRequestError = (
  error: unknown,
): error is AdminRequestError =>
  error instanceof Error && error.name === ADMIN_REQUEST_ERROR;

export const describeAdminParams = (params: object): string =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ") || "no filters";
