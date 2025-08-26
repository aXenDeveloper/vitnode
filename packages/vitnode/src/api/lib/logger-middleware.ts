/** biome-ignore-all lint/suspicious/noConsole: <no need> */
import type { Context } from "hono";

import { core_logs } from "@/database/logs";

type CoreLogsType = "debug" | "error" | "warn";

export interface LoggerMiddlewareType {
  debug: (content: string) => Promise<void>;
  error: (content: string) => Promise<void>;
  warn: (content: string) => Promise<void>;
}

export const loggerMiddleware = (c: Context): LoggerMiddlewareType => {
  const logToDbAndConsole = async (content: string, type: CoreLogsType) => {
    const pluginId = c.get("plugin")?.id ?? "core";
    const ipAddress = c.get("ipAddress");

    await c
      .get("db")
      .insert(core_logs)
      .values({
        pluginId,
        type,
        content,
        ipAddress,
        method: c.req.method.toUpperCase(),
        path: c.req.path,
        userAgent: c.req.header("User-Agent"),
        statusCode: c.res.status,
        userId: c.get("user")?.id,
      });

    const loggers: Record<CoreLogsType, (msg: string) => void> = {
      debug: msg =>
        console.debug(
          `\x1b[34m[VitNode]\x1b[0m \x1b[38;5;208mDebug (${pluginId})\x1b[0m: ${msg}`,
        ),
      error: msg =>
        console.error(
          `\x1b[34m[VitNode]\x1b[0m \x1b[31mError (${pluginId})\x1b[0m: ${msg}`,
        ),
      warn: msg =>
        console.warn(
          `\x1b[34m[VitNode]\x1b[0m \x1b[33mWarning (${pluginId})\x1b[0m: ${msg}`,
        ),
    };
    (loggers[type] ?? loggers.debug)(content);
  };

  return {
    debug: async (content: string) => {
      await logToDbAndConsole(content, "debug");
    },
    error: async (content: string) => {
      await logToDbAndConsole(content, "error");
    },
    warn: async (content: string) => {
      await logToDbAndConsole(content, "warn");
    },
  };
};
