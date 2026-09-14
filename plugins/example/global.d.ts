/// <reference types="use-intl" />

import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core;
  }
}
