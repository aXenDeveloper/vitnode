import "@tanstack/react-start/server-only";

import { middlewareModule } from "@/api/modules/middleware/middleware.module";
import { fetcher } from "@/tanstack/fetcher/server";

import type { MiddlewareConfigState } from "./middleware-config";

import {
  knownMiddlewareConfig,
  UNKNOWN_MIDDLEWARE_CONFIG,
} from "./middleware-config";

export const fetchMiddlewareConfigOnServer =
  async (): Promise<MiddlewareConfigState> => {
    try {
      const response = await fetcher(middlewareModule, {
        method: "get",
        module: "middleware",
        path: "/",
      });

      if (response.status !== 200) return UNKNOWN_MIDDLEWARE_CONFIG;

      return knownMiddlewareConfig(await response.json());
    } catch (error) {
      console.error("[auth] middleware configuration unavailable", error);

      return UNKNOWN_MIDDLEWARE_CONFIG;
    }
  };
