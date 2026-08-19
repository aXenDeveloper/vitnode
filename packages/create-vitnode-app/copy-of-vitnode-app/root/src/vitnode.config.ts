import { handleRequestConfig } from "@vitnode/core/lib/i18n/request-config";
import { buildConfig } from "@vitnode/core/vitnode.config";
import { getRequestConfig } from "next-intl/server";

import { i18n } from "./i18n";

export const vitNodeConfig = buildConfig({
  metadata: {
    title: "VitNode",
    shortTitle: "VitNode",
  },
  plugins: [],
  i18n,
  theme: {
    defaultTheme: "light",
  },
});

// This is the request config for the app. It will be used in the app router.
export default getRequestConfig(
  async params =>
    await handleRequestConfig({
      params,
      vitNodeConfig,
    }),
);
