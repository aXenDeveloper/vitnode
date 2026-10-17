import type { Plugin, UserConfig } from "vite";

import { fileURLToPath } from "node:url";

import { DEV_ERROR_REPORT_ROUTE } from "../dev-error/report-route";

const DEV_ERROR_HANDLER_MODULE = "@vitnode/core/framework/dev-error/handler";
const DEV_ERROR_REPORT_MODULE =
  "@vitnode/core/framework/dev-error/report-handler";

interface NitroDevErrorConfig {
  nitro: {
    errorHandler: string[];
    handlers: { handler: string; method: "POST"; route: string }[];
  };
}

const modulePath = (specifier: string) =>
  fileURLToPath(import.meta.resolve(specifier));

const withNitroDevError = (): UserConfig => {
  const config: NitroDevErrorConfig = {
    nitro: {
      errorHandler: [modulePath(DEV_ERROR_HANDLER_MODULE)],
      handlers: [
        {
          handler: modulePath(DEV_ERROR_REPORT_MODULE),
          method: "POST",
          route: DEV_ERROR_REPORT_ROUTE,
        },
      ],
    },
  };

  return config as UserConfig;
};

/**
 * In `vite dev`, registers Nitro handlers that answer unhandled server errors
 * in HTML requests with VitNode's development error page, including any hints
 * the error carries. Does nothing in a build.
 */
export const vitNodeDevError = (): Plugin => ({
  config: (_userConfig, { command }) =>
    command === "serve" ? withNitroDevError() : undefined,
  name: "vitnode:dev-error",
});
