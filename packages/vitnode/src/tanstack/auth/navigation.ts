import { useRouter } from "@tanstack/react-router";

import type { AuthNavigate } from "./actions";
import type { InternalDestination } from "./redirects";

import { readRequestHost } from "../i18n/locale";
import { getIntlRuntime } from "../i18n/runtime";
import { createAuthNavigation } from "./redirects";

export const internalDestination = (href: string): InternalDestination =>
  createAuthNavigation({
    localeRouting: getIntlRuntime().localeRouting,
    readHost: readRequestHost,
  }).internalDestination(href);

export const useAppNavigate = (): AuthNavigate => {
  const router = useRouter();

  return async (href: string): Promise<void> => {
    await router.navigate(internalDestination(href));
  };
};
