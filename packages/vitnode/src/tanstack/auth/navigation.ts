import type { InternalDestination } from "./redirects";

import { readRequestHost } from "../i18n/locale";
import { getIntlRuntime } from "../i18n/runtime";
import { createAuthNavigation } from "./redirects";

export const internalDestination = (href: string): InternalDestination =>
  createAuthNavigation({
    localeRouting: getIntlRuntime().localeRouting,
    readHost: readRequestHost,
  }).internalDestination(href);
