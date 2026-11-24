import type { LocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

import type { ResolvedSeoPolicy } from "./policy.server";

import { localesOnOrigin } from "./policy.server";

/** Never locale-prefixed: the AdminCP. */
const UNLOCALIZED_EXCLUSIONS = ["/admin"];

/** Locale-routed private areas: every locale's URL of these is excluded. */
const LOCALIZED_EXCLUSIONS = ["/settings"];

/**
 * The paths `User-agent: *` disallows on one origin: the AdminCP and the
 * account settings, with each locale's prefix and translated path that origin
 * serves. Pages there are protected by their own authorization; this only
 * keeps crawlers from asking.
 */
export const seoBaselineExclusions = ({
  origin,
  routing,
  webOrigin,
}: {
  origin: string;
  routing: LocaleRouting;
  webOrigin: string;
}): string[] => {
  const host = new URL(origin).host;
  const locales = localesOnOrigin(routing, origin, webOrigin);
  const served = locales.length > 0 ? locales : routing.locales;

  return [
    ...new Set([
      ...UNLOCALIZED_EXCLUSIONS,
      ...LOCALIZED_EXCLUSIONS.flatMap(path => [
        path,
        ...served.map(locale =>
          routing.localizePathname(path, locale, { host }),
        ),
      ]),
    ]),
  ];
};

/**
 * `/robots.txt` for one trusted origin. Deterministic: the same policy and
 * origin always give the same bytes.
 *
 * - `User-agent: *` allows the site and disallows the baseline exclusions.
 * - Each configured bot gets its own group: `Disallow: /` when it is turned
 *   off, or the baseline rules again when it is turned on - a crawler obeys
 *   only its most specific group, so an allow group without them would open
 *   the AdminCP to it.
 * - Exactly one absolute `Sitemap:` line when the sitemap is published.
 */
export const seoRobotsTxt = ({
  origin,
  policy,
  routing,
  webOrigin,
}: {
  origin: string;
  policy: ResolvedSeoPolicy;
  routing: LocaleRouting;
  webOrigin: string;
}): string => {
  const exclusions = seoBaselineExclusions({ origin, routing, webOrigin });
  const baseline = ["Allow: /", ...exclusions.map(path => `Disallow: ${path}`)];
  const groups = [
    ["User-agent: *", ...baseline],
    ...policy.crawlers.map(rule => [
      `User-agent: ${rule.token}`,
      ...(rule.allow ? baseline : ["Disallow: /"]),
    ]),
  ];
  const blocks = groups.map(lines => lines.join("\n"));

  if (policy.sitemap.enabled) {
    blocks.push(`Sitemap: ${new URL("/sitemap.xml", origin).href}`);
  }

  return `${blocks.join("\n\n")}\n`;
};
