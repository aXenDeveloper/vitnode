import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { routes } from "./routes";

export const examplePlugin = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    localeFiles: {
      en: "@vitnode/example/locales/en.json",
    },
    messages,
    routes,
  });
