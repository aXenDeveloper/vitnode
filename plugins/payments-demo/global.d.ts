/// <reference types="use-intl" />

import coreApi from "@vitnode/core/locales/api/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core & typeof coreApi;
  }
}
