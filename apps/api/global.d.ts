/// <reference types="use-intl" />

import core from "@vitnode/core/locales/api/en.json" with { type: "json" };

declare module "use-intl" {
  interface AppConfig {
    Messages: typeof core;
  }
}
