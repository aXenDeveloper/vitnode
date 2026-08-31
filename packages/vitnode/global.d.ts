/// <reference types="use-intl" />

import api from "./src/locales/api/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

// Core holds both the frontend and the server (email) code, so it types keys
// against both trees. Apps that only do one job import only the tree they need.
declare module "use-intl" {
  interface AppConfig {
    Messages: typeof api & typeof plugin;
  }
}
