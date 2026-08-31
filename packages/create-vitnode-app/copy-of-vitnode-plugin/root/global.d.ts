/// <reference types="use-intl" />

import coreApi from "@vitnode/core/locales/api/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

// Augmenting `use-intl`, not `next-intl`. `AppConfig` is declared by `use-intl`,
// which is what VitNode renders every string through on every host, and a plugin
// is compiled into its own `dist` and imported by whichever app installed it -
// so a type-level dependency on one host's framework is one every installing app
// inherits. `use-intl` must be a direct dependency of this package for the
// reference above to resolve under pnpm's strict `node_modules`.
//
// A plugin can render on both sides (UI components and, e.g., emails), so it
// types keys against both of core's trees. Add your own server tree here too
// (`./src/locales/api/en.json`) once your plugin sends email.
declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core & typeof coreApi;
  }
}
