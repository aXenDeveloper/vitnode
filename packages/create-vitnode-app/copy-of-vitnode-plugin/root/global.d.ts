/// <reference types="next-intl" />

import coreApi from "@vitnode/core/locales/api/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

// A plugin can render on both sides (UI components and, e.g., emails), so it
// types keys against both of core's trees. Add your own server tree here too
// (`./src/locales/api/en.json`) once your plugin sends email.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core & typeof coreApi;
  }
}
