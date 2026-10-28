import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { manifest } from "./manifest.gen";
import { routes } from "./routes";

export const paymentsDemoPlugin = () =>
  buildPlugin({
    manifest,
    localeFiles: {
      en: "payments-demo/locales/en.json",
    },
    messages,
    routes,
  });
