/* eslint-disable no-console */
import type { Context } from 'hono';

import { core_logs, type CoreLogsType } from '@/database/logs';

export interface LoggerMiddlewareType {
  debug: (content: string) => void;
  error: (content: string) => void;
  warn: (content: string) => void;
}

export const loggerMiddleware = (c: Context): LoggerMiddlewareType => {
  const logToDbAndConsole = async (content: string, type: CoreLogsType) => {
    const pluginId = c.get('plugin')?.id ?? 'core';
    const ipAddress = c.get('ipAddress');

    await c.get('db').insert(core_logs).values({
      pluginId,
      type,
      content,
      ipAddress,
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
    debug: (content: string) => {
      void logToDbAndConsole(content, 'debug');
    },
    error: (content: string) => {
      void logToDbAndConsole(content, 'error');
    },
    warn: (content: string) => {
      void logToDbAndConsole(content, 'warn');
    },
  };
};
