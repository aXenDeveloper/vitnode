import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { manifest } from "./manifest.gen";
import { routes } from "./routes";

export const examplePlugin = () =>
  buildPlugin({
    manifest,
    localeFiles: {
      en: "@vitnode/example/locales/en.json",
    },
    messages,
    routes,
  });
