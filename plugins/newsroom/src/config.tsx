import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { manifest } from "./manifest.gen";
import { routes } from "./routes";

export const newsroomPlugin = () =>
  buildPlugin({
    manifest,
    localeFiles: {
      en: "newsroom/locales/en.json",
    },
    messages,
    routes,
  });
