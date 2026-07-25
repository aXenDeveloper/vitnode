/// <reference types="next-intl" />

import coreApi from "@vitnode/core/locales/api/en.json" with { type: "json" };
import blog from "@vitnode/blog/locales/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof core & typeof coreApi & typeof blog;
  }
}
