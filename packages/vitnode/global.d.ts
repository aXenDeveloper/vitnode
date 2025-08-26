/// <reference types="next-intl" />

import plugin from "./src/locales/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof plugin;
  }
}
