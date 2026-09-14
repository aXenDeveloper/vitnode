/// <reference types="use-intl" />

import core from "@vitnode/core/locales/en.json" with { type: "json" };
import plugin from "./src/locales/en.json" with { type: "json" };

import type { blogApiPlugin } from "./src/config.api";

declare module "use-intl" {
  interface AppConfig {
    Messages: typeof plugin & typeof core;
  }
}

declare module "@vitnode/core/lib/fetcher/registry" {
  interface ApiPluginRegistry {
    "@vitnode/blog": typeof blogApiPlugin;
  }
}

export type { ApiPluginRegistry } from "@vitnode/core/lib/fetcher/registry";
