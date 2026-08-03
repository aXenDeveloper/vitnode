import { blogPlugin } from "@vitnode/blog/config";
import { buildConfig, handleRequestConfig } from "@vitnode/core/vitnode.config";
import { examplePlugin } from "@vitnode/example/config";
import { getRequestConfig } from "next-intl/server";

import { i18n } from "./i18n";

export const vitNodeConfig = buildConfig({
  metadata: {
    title: "VitNode",
    shortTitle: "VitNode",
  },
  plugins: [blogPlugin(), examplePlugin()],
  debug: false,
  i18n,
  theme: {
    defaultTheme: "light",
  },
});

// This is the request config for the app. It will be used in the app router.
export default getRequestConfig(
  async ({ requestLocale }) =>
    await handleRequestConfig({
      requestLocale,
      vitNodeConfig,
    }),
);
