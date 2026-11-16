import type { LocaleDomainConfig } from "./types";

import { LocaleRoutingConfigError } from "./route-paths";

export interface ResolvedLocaleDomain {
  defaultLocale: string;
  host: string;
  locales: readonly string[];
  origin: string;
}

export interface ResolveLocaleDomainsOptions {
  domains?: readonly LocaleDomainConfig[];
  localePrefix: "always" | "as-needed" | "never";
  locales: readonly string[];
}

const HOST_CHARACTERS = /^[a-z0-9.\-:[\]]+$/;
const MAX_HOST_LENGTH = 261;

export const normalizeHost = (
  value: null | string | undefined,
): string | undefined => {
  if (typeof value !== "string") return undefined;

  const [first] = value.split(",");
  const candidate = first.trim().toLowerCase();
  if (candidate.length > MAX_HOST_LENGTH) return undefined;
  if (!HOST_CHARACTERS.test(candidate)) return undefined;

  let url: URL;
  try {
    url = new URL(`http://${candidate}`);
  } catch {
    return undefined;
  }

  const hostname = url.hostname.replace(/\.$/, "");
  if (hostname.length === 0) return undefined;

  const port = url.port && url.port !== "443" ? `:${url.port}` : "";

  return `${hostname}${port}`;
};

const parseOrigin = (origin: unknown, index: number): URL => {
  const invalid = (reason: string) =>
    new LocaleRoutingConfigError(
      `i18n.domains[${index}].origin ${reason}. Write the scheme and host only, e.g. "https://vitnode.pl".`,
      {
        code: "invalid-domain",
        origin: typeof origin === "string" ? origin : undefined,
      },
    );

  if (typeof origin !== "string" || origin.length === 0) {
    throw invalid("must be a non-empty string");
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw invalid(`"${origin}" is not a URL`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw invalid(`"${origin}" must use http or https`);
  }

  if (url.username || url.password) {
    throw invalid(`"${origin}" must not contain credentials`);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw invalid(`"${origin}" must not have a path, query or fragment`);
  }

  return url;
};

export const resolveLocaleDomains = ({
  domains,
  localePrefix,
  locales,
}: ResolveLocaleDomainsOptions): ResolvedLocaleDomain[] => {
  if (!domains || domains.length === 0) {
    if (localePrefix === "never" && locales.length > 1) {
      throw new LocaleRoutingConfigError(
        `i18n.localePrefix is "never" but ${locales.length} locales (${locales.map(code => `"${code}"`).join(", ")}) share one host, so one URL would serve several languages. Give each locale its own origin in i18n.domains, or use localePrefix "as-needed".`,
        { code: "ambiguous-never-prefix" },
      );
    }

    return [];
  }

  const byHost = new Map<string, number>();
  const byLocale = new Map<string, string>();
  const resolved: ResolvedLocaleDomain[] = [];

  for (const [index, domain] of domains.entries()) {
    const url = parseOrigin(domain.origin, index);
    const host = normalizeHost(url.host);
    if (!host) {
      throw new LocaleRoutingConfigError(
        `i18n.domains[${index}].origin "${domain.origin}" has an invalid host.`,
        { code: "invalid-domain", origin: domain.origin },
      );
    }

    const previous = byHost.get(host);
    if (previous !== undefined) {
      throw new LocaleRoutingConfigError(
        `i18n.domains[${previous}] and i18n.domains[${index}] both use "${host}". A host can belong to one entry only - merge their locales.`,
        { code: "duplicate-domain", origin: domain.origin },
      );
    }
    byHost.set(host, index);

    const domainLocales = [
      ...new Set(domain.locales ?? [domain.defaultLocale]),
    ];

    if (!domainLocales.includes(domain.defaultLocale)) {
      throw new LocaleRoutingConfigError(
        `i18n.domains[${index}] ("${url.origin}") has defaultLocale "${domain.defaultLocale}", which is not in its locales (${domainLocales.map(code => `"${code}"`).join(", ")}).`,
        {
          code: "unknown-domain-locale",
          locale: domain.defaultLocale,
          origin: url.origin,
        },
      );
    }

    for (const locale of domainLocales) {
      if (!locales.includes(locale)) {
        throw new LocaleRoutingConfigError(
          `i18n.domains[${index}] ("${url.origin}") serves "${locale}", which is not an enabled locale.`,
          { code: "unknown-domain-locale", locale, origin: url.origin },
        );
      }

      const owner = byLocale.get(locale);
      if (owner !== undefined) {
        throw new LocaleRoutingConfigError(
          `"${locale}" is assigned to both "${owner}" and "${url.origin}". A language needs exactly one home, or its canonical URL is ambiguous.`,
          {
            code: "domain-locale-conflict",
            conflictsWith: owner,
            locale,
            origin: url.origin,
          },
        );
      }
      byLocale.set(locale, url.origin);
    }

    if (localePrefix === "never" && domainLocales.length > 1) {
      throw new LocaleRoutingConfigError(
        `i18n.domains[${index}] ("${url.origin}") serves ${domainLocales.map(code => `"${code}"`).join(", ")} with localePrefix "never", so its URLs could not tell them apart. Give each locale its own origin, or use localePrefix "as-needed".`,
        { code: "ambiguous-never-prefix", origin: url.origin },
      );
    }

    resolved.push({
      defaultLocale: domain.defaultLocale,
      host,
      locales: domainLocales,
      origin: url.origin,
    });
  }

  const unassigned = locales.filter(locale => !byLocale.has(locale));
  if (unassigned.length > 0) {
    throw new LocaleRoutingConfigError(
      `i18n.domains does not assign ${unassigned.map(code => `"${code}"`).join(", ")}. Once domains are configured, every enabled locale needs one, so a link to it always knows which host to open.`,
      { code: "unassigned-locale", locale: unassigned[0] },
    );
  }

  return resolved;
};
