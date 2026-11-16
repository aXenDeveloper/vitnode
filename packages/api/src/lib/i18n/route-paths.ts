import type { ParseRoutePathResult } from "../../routing/path";
import type { PluginRouteSegment } from "../../routing/types";
import type { LocaleRoutePaths } from "./types";

import {
  formatRoutePath,
  parseRoutePath,
  routeMatchKey,
} from "../../routing/path";

export type LocaleRoutingConfigErrorCode =
  | "ambiguous-never-prefix"
  | "domain-locale-conflict"
  | "duplicate-domain"
  | "duplicate-route-path"
  | "duplicate-source-path"
  | "inconsistent-layout-path"
  | "invalid-domain"
  | "invalid-route-path"
  | "locale-segment"
  | "parameter-mismatch"
  | "reserved-route-path"
  | "root-route-path"
  | "route-collision"
  | "route-shadowed"
  | "unassigned-locale"
  | "unknown-domain-locale"
  | "unknown-route-locale"
  | "unknown-source-path";

export interface LocaleRoutingConfigErrorDetails {
  code: LocaleRoutingConfigErrorCode;
  conflictsWith?: string;
  locale?: string;
  origin?: string;
  sourcePath?: string;
  translatedPath?: string;
}

export class LocaleRoutingConfigError extends Error {
  constructor(message: string, details: LocaleRoutingConfigErrorDetails) {
    super(`[VitNode i18n] ${message}`);
    this.name = "LocaleRoutingConfigError";
    this.code = details.code;
    this.conflictsWith = details.conflictsWith;
    this.locale = details.locale;
    this.origin = details.origin;
    this.sourcePath = details.sourcePath;
    this.translatedPath = details.translatedPath;
  }
  readonly code: LocaleRoutingConfigErrorCode;
  readonly conflictsWith?: string;
  readonly locale?: string;
  readonly origin?: string;
  readonly sourcePath?: string;

  readonly translatedPath?: string;
}

export interface CompiledRoutePath {
  locale: string;
  publicPath: string;
  publicSegments: readonly PluginRouteSegment[];
  sourcePath: string;
  sourceSegments: readonly PluginRouteSegment[];
}

export interface RoutePathTranslator {
  readonly entries: readonly CompiledRoutePath[];
  toInternal: (publicPathname: string, locale: string) => string;
  toPublic: (internalPathname: string, locale: string) => string;
  translates: (locale: string) => boolean;
}

export interface CompileRoutePathsOptions {
  isIgnoredPath: (pathname: string) => boolean;
  localePrefix: "always" | "as-needed" | "never";
  locales: readonly string[];
  routePaths?: LocaleRoutePaths;
}

const ASCII_ONLY = /^[ -~]*$/;
const LOCALIZED_STATIC_SEGMENT =
  /^[\p{Ll}\p{Lo}\p{N}][\p{Ll}\p{Lo}\p{M}\p{N}._-]*$/u;
const ASCII_PLACEHOLDER_SEGMENT = "x";
const SPLAT_CAPTURE = "*";

export const parseLocalizedRoutePath = (path: string): ParseRoutePathResult => {
  if (typeof path !== "string") return parseRoutePath(path);

  const rawSegments = path.split("/");
  const localizedSegments = new Map<number, string>();
  const asciiPath = rawSegments
    .map((segment, index) => {
      const normalized = segment.normalize("NFC");
      if (ASCII_ONLY.test(normalized)) return segment;
      if (!LOCALIZED_STATIC_SEGMENT.test(normalized)) return segment;

      localizedSegments.set(index - 1, normalized);

      return ASCII_PLACEHOLDER_SEGMENT;
    })
    .join("/");

  const parsed = parseRoutePath(asciiPath);
  if (!parsed.ok || localizedSegments.size === 0) return parsed;

  const segments = parsed.segments.map((segment, index): PluginRouteSegment => {
    const localized = localizedSegments.get(index);

    return localized === undefined
      ? segment
      : { kind: "static", value: localized };
  });

  return { ok: true, path: formatRoutePath(segments), segments };
};

const SEGMENT_RANK: Record<PluginRouteSegment["kind"], number> = {
  param: 3,
  splat: 1,
  static: 4,
};

const END_OF_PATH_RANK = 2;

const rankAt = (segments: readonly PluginRouteSegment[], index: number) => {
  const segment = segments.at(index);

  return segment ? SEGMENT_RANK[segment.kind] : END_OF_PATH_RANK;
};

export const compareRouteSpecificity = (
  a: readonly PluginRouteSegment[],
  b: readonly PluginRouteSegment[],
): number => {
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const rankA = rankAt(a, index);
    const rankB = rankAt(b, index);
    if (rankA !== rankB) return rankB - rankA;
  }

  return 0;
};

interface SplitPathname {
  segments: string[];
  trailingSlash: boolean;
}

const splitPathname = (pathname: string): SplitPathname => {
  if (pathname === "" || pathname === "/") {
    return { segments: [], trailingSlash: false };
  }

  const trailingSlash = pathname.endsWith("/");
  const trimmed = trailingSlash ? pathname.slice(0, -1) : pathname;

  return {
    segments: trimmed.replace(/^\//, "").split("/"),
    trailingSlash,
  };
};

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const staticMatches = (segment: string, value: string): boolean =>
  decodeSegment(segment).normalize("NFC").toLowerCase() === value;

export const matchRouteSegments = (
  pattern: readonly PluginRouteSegment[],
  segments: readonly string[],
): Map<string, string> | undefined => {
  const captures = new Map<string, string>();

  for (const [index, part] of pattern.entries()) {
    if (part.kind === "splat") {
      captures.set(SPLAT_CAPTURE, segments.slice(index).join("/"));

      return captures;
    }

    const segment = segments.at(index);
    if (segment === undefined || segment === "") return undefined;

    if (part.kind === "static") {
      if (!staticMatches(segment, part.value)) return undefined;
    } else {
      captures.set(part.name, segment);
    }
  }

  return segments.length === pattern.length ? captures : undefined;
};

export const fillRouteSegments = (
  pattern: readonly PluginRouteSegment[],
  captures: ReadonlyMap<string, string>,
): string => {
  const parts: string[] = [];

  for (const part of pattern) {
    if (part.kind === "static") {
      parts.push(encodeURIComponent(part.value));
    } else if (part.kind === "param") {
      parts.push(captures.get(part.name) ?? "");
    } else {
      const rest = captures.get(SPLAT_CAPTURE);
      if (rest) parts.push(rest);
    }
  }

  return `/${parts.join("/")}`;
};

const translatePathname = (
  pathname: string,
  entries: readonly CompiledRoutePath[],
  from: "publicSegments" | "sourceSegments",
  to: "publicSegments" | "sourceSegments",
): string => {
  if (entries.length === 0) return pathname;

  const { segments, trailingSlash } = splitPathname(pathname);

  for (const entry of entries) {
    const captures = matchRouteSegments(entry[from], segments);
    if (!captures) continue;

    const translated = fillRouteSegments(entry[to], captures);

    return trailingSlash && translated !== "/" ? `${translated}/` : translated;
  }

  return pathname;
};

const paramNames = (segments: readonly PluginRouteSegment[]): string[] =>
  segments.flatMap(segment => (segment.kind === "param" ? [segment.name] : []));

const hasSplat = (segments: readonly PluginRouteSegment[]): boolean =>
  segments.some(segment => segment.kind === "splat");

const describeEntry = (locale: string, source: string, translated: string) =>
  `i18n.routePaths.${locale}["${source}"] = "${translated}"`;

const assertSameParameters = (
  locale: string,
  source: { path: string; segments: readonly PluginRouteSegment[] },
  translated: { path: string; segments: readonly PluginRouteSegment[] },
) => {
  const sourceParams = paramNames(source.segments);
  const translatedParams = paramNames(translated.segments);
  const missing = sourceParams.filter(name => !translatedParams.includes(name));
  const added = translatedParams.filter(name => !sourceParams.includes(name));
  const details = {
    code: "parameter-mismatch" as const,
    locale,
    sourcePath: source.path,
    translatedPath: translated.path,
  };
  const entry = describeEntry(locale, source.path, translated.path);

  if (missing.length === 1 && added.length === 1) {
    throw new LocaleRoutingConfigError(
      `${entry} renames ":${missing[0]}" to ":${added[0]}". A translation changes how a URL is spelled, not what the page receives - keep ":${missing[0]}".`,
      details,
    );
  }

  if (missing.length > 0) {
    throw new LocaleRoutingConfigError(
      `${entry} is missing ${missing.map(name => `":${name}"`).join(", ")}. Every parameter of the English path has to appear in the translation.`,
      details,
    );
  }

  if (added.length > 0) {
    throw new LocaleRoutingConfigError(
      `${entry} adds ${added.map(name => `":${name}"`).join(", ")}, which the English path does not have. The route would never receive it.`,
      details,
    );
  }

  if (hasSplat(source.segments) !== hasSplat(translated.segments)) {
    throw new LocaleRoutingConfigError(
      hasSplat(source.segments)
        ? `${entry} drops the "*" catch-all of the English path. Keep "*" as the last segment.`
        : `${entry} adds a "*" catch-all the English path does not have.`,
      details,
    );
  }
};

const parseOrThrow = (
  locale: string,
  source: string,
  translated: string,
  which: "source" | "translated",
) => {
  const parsed =
    which === "source"
      ? parseRoutePath(source)
      : parseLocalizedRoutePath(translated);

  if (!parsed.ok) {
    throw new LocaleRoutingConfigError(
      `${describeEntry(locale, source, translated)}: the ${which === "source" ? "English source path" : "translated path"} is invalid - ${parsed.reason}.`,
      {
        code: "invalid-route-path",
        locale,
        sourcePath: source,
        translatedPath: translated,
      },
    );
  }

  return parsed;
};

const compileEntry = (
  locale: string,
  source: string,
  translated: string,
  options: CompileRoutePathsOptions,
): CompiledRoutePath => {
  if (typeof translated !== "string") {
    throw new LocaleRoutingConfigError(
      `i18n.routePaths.${locale}["${source}"] must be a string path such as "/artykuly".`,
      { code: "invalid-route-path", locale, sourcePath: source },
    );
  }

  const parsedSource = parseOrThrow(locale, source, translated, "source");
  const parsedTranslated = parseOrThrow(
    locale,
    source,
    translated,
    "translated",
  );
  const entry = describeEntry(locale, source, translated);

  if (
    parsedSource.segments.length === 0 ||
    parsedTranslated.segments.length === 0
  ) {
    throw new LocaleRoutingConfigError(
      `${entry} translates the home page. "/" is every locale's root and is spelled by i18n.localePrefix, not by a route translation.`,
      {
        code: "root-route-path",
        locale,
        sourcePath: source,
        translatedPath: translated,
      },
    );
  }

  for (const [path, label] of [
    [parsedSource.path, "English path"],
    [parsedTranslated.path, "translated path"],
  ] as const) {
    if (options.isIgnoredPath(path)) {
      throw new LocaleRoutingConfigError(
        `${entry}: the ${label} "${path}" is under a reserved prefix (/admin, /api). Admin and API URLs are never localized.`,
        {
          code: "reserved-route-path",
          locale,
          sourcePath: source,
          translatedPath: translated,
        },
      );
    }
  }

  const [first] = parsedTranslated.segments;
  if (
    options.localePrefix !== "never" &&
    first.kind === "static" &&
    options.locales.includes(first.value)
  ) {
    throw new LocaleRoutingConfigError(
      `${entry} starts with "/${first.value}", which is a locale prefix in this app. The URL would be read as that language - choose another first segment.`,
      {
        code: "locale-segment",
        locale,
        sourcePath: source,
        translatedPath: translated,
      },
    );
  }

  assertSameParameters(
    locale,
    { path: parsedSource.path, segments: parsedSource.segments },
    { path: parsedTranslated.path, segments: parsedTranslated.segments },
  );

  return {
    locale,
    publicPath: parsedTranslated.path,
    publicSegments: parsedTranslated.segments,
    sourcePath: parsedSource.path,
    sourceSegments: parsedSource.segments,
  };
};

const assertUniquePatterns = (
  locale: string,
  entries: readonly CompiledRoutePath[],
  key: "publicSegments" | "sourceSegments",
) => {
  const seen = new Map<string, CompiledRoutePath>();

  for (const entry of entries) {
    const matchKey = routeMatchKey([...entry[key]]);
    const previous = seen.get(matchKey);

    if (previous) {
      const isPublic = key === "publicSegments";

      throw new LocaleRoutingConfigError(
        isPublic
          ? `${describeEntry(locale, entry.sourcePath, entry.publicPath)} and ${describeEntry(locale, previous.sourcePath, previous.publicPath)} match the same URLs (parameter names do not count). One public URL can only reach one route - give one of them a different spelling.`
          : `i18n.routePaths.${locale} lists "${entry.sourcePath}" and "${previous.sourcePath}", which are the same route pattern. Keep one of them.`,
        {
          code: isPublic ? "duplicate-route-path" : "duplicate-source-path",
          conflictsWith: previous.sourcePath,
          locale,
          sourcePath: entry.sourcePath,
          translatedPath: entry.publicPath,
        },
      );
    }

    seen.set(matchKey, entry);
  }
};

export const compileRoutePaths = (
  options: CompileRoutePathsOptions,
): RoutePathTranslator => {
  const bySource = new Map<string, CompiledRoutePath[]>();
  const byPublic = new Map<string, CompiledRoutePath[]>();
  const entries: CompiledRoutePath[] = [];

  for (const [locale, table] of Object.entries(options.routePaths ?? {})) {
    if (!options.locales.includes(locale)) {
      throw new LocaleRoutingConfigError(
        `i18n.routePaths has translations for "${locale}", which is not an enabled locale. Enabled: ${options.locales.map(code => `"${code}"`).join(", ")}. Add it to i18n.locales or remove its routePaths.`,
        { code: "unknown-route-locale", locale },
      );
    }

    if (table === undefined) continue;
    if (typeof table !== "object" || table === null || Array.isArray(table)) {
      throw new LocaleRoutingConfigError(
        `i18n.routePaths.${locale} must be an object of { "/english/path": "/translated/path" }.`,
        { code: "invalid-route-path", locale },
      );
    }

    const compiled = Object.entries(table).map(([source, translated]) =>
      compileEntry(locale, source, translated, options),
    );

    assertUniquePatterns(locale, compiled, "sourceSegments");
    assertUniquePatterns(locale, compiled, "publicSegments");

    entries.push(...compiled);
    bySource.set(
      locale,
      compiled.toSorted((a, b) =>
        compareRouteSpecificity(a.sourceSegments, b.sourceSegments),
      ),
    );
    byPublic.set(
      locale,
      compiled.toSorted((a, b) =>
        compareRouteSpecificity(a.publicSegments, b.publicSegments),
      ),
    );
  }

  return {
    entries,
    toInternal: (publicPathname, locale) =>
      translatePathname(
        publicPathname,
        byPublic.get(locale) ?? [],
        "publicSegments",
        "sourceSegments",
      ),
    toPublic: (internalPathname, locale) =>
      translatePathname(
        internalPathname,
        bySource.get(locale) ?? [],
        "sourceSegments",
        "publicSegments",
      ),
    translates: locale => (bySource.get(locale)?.length ?? 0) > 0,
  };
};
