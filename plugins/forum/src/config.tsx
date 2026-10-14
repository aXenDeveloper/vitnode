import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { routes } from "./routes";

export const forumPlugin = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    localeFiles: {
      en: "@vitnode/forum/locales/en.json",
    },
    messages,
    routes,
  });
