/// <reference types="next-intl" />

import core from "./src/locales/@vitnode/core/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof core;
  }
}
