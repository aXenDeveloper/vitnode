/// <reference types="use-intl" />

import plugin from "./src/locales/en.json" with { type: "json" };

// Core holds the frontend; the API's server (email) strings are typed in
// `@vitnode/api`. Apps that do both jobs type keys against both trees.
declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin;
  }
}
