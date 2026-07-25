/// <reference types="next-intl" />

import coreApi from "@vitnode/core/locales/api/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };

// A single app serves the frontend and runs the API, so it types keys against
// both of core's trees - its UI strings and its email strings.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof core & typeof coreApi;
  }
}
