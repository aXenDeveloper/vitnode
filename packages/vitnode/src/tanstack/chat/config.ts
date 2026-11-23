import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import { getVitNodeConfig } from "@/vitnode.config";

import {
  loadMiddlewareConfig,
  MiddlewareConfigUnknownError,
} from "../auth/middleware-config";

const chatConfig = () => {
  try {
    return getVitNodeConfig().chat;
  } catch {
    // No registered config (tests, isolated renders): defaults apply.
    return undefined;
  }
};

/** `chat.enabled` in the app's `vitnode.config.ts`; `true` unless turned off. */
export const isChatUiEnabled = (): boolean => chatConfig()?.enabled !== false;

/** `chat.dock` in the app's `vitnode.config.ts`; `true` unless turned off. */
export const isChatDockEnabled = (): boolean =>
  isChatUiEnabled() && chatConfig()?.dock !== false;

/**
 * For a chat route's `load`: 404 when chat is off in the app config or in
 * the API config.
 */
export const requireChatRoute = async (
  queryClient: QueryClient,
): Promise<void> => {
  // oxlint-disable-next-line typescript/only-throw-error
  if (!isChatUiEnabled()) throw notFound();
  const config = await loadMiddlewareConfig(queryClient);
  if (!config.isKnown) throw new MiddlewareConfigUnknownError();
  // oxlint-disable-next-line typescript/only-throw-error
  if (config.chat?.enabled === false) throw notFound();
};
