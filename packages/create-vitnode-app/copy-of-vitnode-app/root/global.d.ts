/// <reference types="use-intl" />

import core from "@vitnode/core/locales/en.json" with { type: "json" };

import app from "./src/locales/app/en.json" with { type: "json" };

declare module "use-intl" {
  interface AppConfig {
    // The app's own strings (`src/locales/app`) and core's. Add a plugin's
    // `typeof` here when you use its keys in app code.
    Messages: typeof app & typeof core;
  }
}
