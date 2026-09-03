import "@tanstack/react-start/server-only";

/**
 * The half of VitNode's TanStack i18n runtime that only ever runs on a server.
 *
 * Two things, and both are here rather than in the client-safe barrel for the
 * same reason: they reach the message files inside each package's build output,
 * and the plugin registry they are merged from must never reach a browser
 * bundle. The `server-only` marker above turns "somebody imported this from a
 * component" into a build error rather than a mystery in the client build.
 */
export type {
  BundledMessagesOptions,
  IntlMessagesLoader,
  IntlMessagesLoaderOptions,
} from "./messages";
export {
  buildBundledMessagesSources,
  createIntlMessagesLoader,
} from "./messages";
export type { LocaleRequestPlan } from "./request";
export { handleLocaleRequest } from "./request";
export type { IntlMessages } from "./runtime";
