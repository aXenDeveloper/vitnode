/// <reference types="next-intl" />

import blog from "@vitnode/blog/locales/en.json" with { type: "json" };
import core from "@vitnode/core/locales/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof core & typeof blog;
  }
}
