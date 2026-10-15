import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { manifest } from "./manifest.gen";
import { routes } from "./routes";

export const forumPlugin = () =>
  buildPlugin({
    manifest,
    localeFiles: {
      en: "@vitnode/forum/locales/en.json",
    },
    messages,
    routes,
  });
