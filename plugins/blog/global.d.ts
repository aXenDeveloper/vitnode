/// <reference types="next-intl" />

import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core;
  }
}
