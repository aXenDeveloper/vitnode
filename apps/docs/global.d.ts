/// <reference types="next-intl" />

import blog from "./src/locales/@vitnode/blog/en.json" with { type: "json" };
import core from "./src/locales/@vitnode/core/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof core & typeof blog;
  }
}
