import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { routes } from "./routes";

export const blogPlugin = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    localeFiles: {
      en: "@vitnode/blog/locales/en.json",
    },
    messages,
    routes,
  });
