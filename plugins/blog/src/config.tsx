import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { pluginMetadata } from "./plugin-metadata.gen";
import { routes } from "./routes";

export const blogPlugin = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    metadata: pluginMetadata,
    icon: async () => await import("./plugin-icon.gen"),
    localeFiles: {
      en: "@vitnode/blog/locales/en.json",
    },
    messages,
    routes,
  });
