import type { VitNodeConfig } from "@/vitnode.config";

import { CONFIG_PLUGIN } from "@/config";
import { loadMessages } from "@/lib/i18n/load-messages";
import { buildMessagesSources } from "@/lib/i18n/sources";

/**
 * The next-intl request config, kept in its own module rather than alongside
 * `buildConfig` in `vitnode.config.ts`.
 *
 * `next/root-params` is only importable from the App Directory graph, and
 * `vitnode.config.ts` is reached from the Proxy (middleware) and from
 * `vitnode.api.config.ts` inside the catch-all Route Handler. Importing root
 * params there fails the build outright, so the read lives here, behind the one
 * entry point only a Server Component reaches.
 */

/**
 * The root `[locale]` segment, read through `next/root-params`.
 *
 * Root params are known at prerender time, which is what makes a localized
 * route statically renderable - unlike next-intl's header-derived
 * `requestLocale`, reading them does not pull the render into request time.
 *
 * Returns `undefined` rather than throwing when root params are unavailable, so
 * callers fall through to the next source. That covers Server Actions, where
 * `next/root-params` is not supported.
 */
const readRootParamsLocale = async (): Promise<string | undefined> => {
  try {
    const { locale } = await import("next/root-params");

    return await locale();
  } catch {
    return undefined;
  }
};

export const handleRequestConfig = async ({
  params,
  vitNodeConfig,
}: {
  /**
   * next-intl's `getRequestConfig` argument, passed through whole rather than
   * destructured by the caller.
   *
   * `requestLocale` is a getter that calls `headers()` the moment it is read, so
   * destructuring it - even without awaiting - would touch request data on
   * routes that are otherwise fully static. Taking the object lets the read stay
   * behind the root-params check below.
   */
  params: {
    /**
     * A locale named by the caller, e.g. `getTranslations({ locale })`. Wins
     * over everything else - it is the one unambiguously deliberate source.
     */
    locale?: string;
    /**
     * next-intl's header-derived locale. Deprecated upstream in favour of root
     * params, and kept only as the last resort: it is still the sole source in
     * Server Actions, where `next/root-params` is unavailable and no explicit
     * locale is passed.
     */
    requestLocale?: Promise<string | undefined>;
  };
  vitNodeConfig: VitNodeConfig;
}) => {
  const localeCodes = vitNodeConfig.i18n.locales.map(locale => locale.code);
  const isSupported = (value: string | undefined): value is string =>
    value !== undefined && localeCodes.includes(value);

  // Ordered and short-circuiting: each source is consulted only when the ones
  // before it miss, so a statically rendered route never reaches
  // `requestLocale` and stays out of the request-time path.
  const resolveLocale = async (): Promise<string> => {
    if (isSupported(params.locale)) return params.locale;

    const fromRootParams = await readRootParamsLocale();
    if (isSupported(fromRootParams)) return fromRootParams;

    // Root params cover every App Router render, so reaching here means the
    // Server Action path, which `next/root-params` does not support.
    const fromRequest = await params.requestLocale;
    if (isSupported(fromRequest)) return fromRequest;

    return vitNodeConfig.i18n.defaultLocale;
  };

  const locale = await resolveLocale();

  const sources = buildMessagesSources({
    appMessages: vitNodeConfig.i18n.messages,
    plugins: vitNodeConfig.plugins,
  });

  return {
    locale,
    messages: await loadMessages({
      defaultLocale: vitNodeConfig.i18n.defaultLocale,
      locale,
      sources,
    }),
    pluginIds: [
      CONFIG_PLUGIN.pluginId,
      ...vitNodeConfig.plugins.map(plugin => plugin.pluginId),
    ],
    timeZone: vitNodeConfig.i18n.timeZone,
  };
};
