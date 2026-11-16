/// <reference types="use-intl" />

import api from "./src/locales/en.json" with { type: "json" };

// The API translates only its own server strings (emails), so keys are typed
// against that tree alone.
declare module "use-intl" {
  interface AppConfig {
    Messages: typeof api;
  }
}
