import type { PluginRouteSegment } from "../../routing/types";
import type { CompiledRoutePath, RoutePathTranslator } from "./route-paths";

import { formatRoutePath, routeMatchKey } from "../../routing/path";
import {
  compareRouteSpecificity,
  LocaleRoutingConfigError,
} from "./route-paths";

export type RoutePathTargetKind = "host" | "layout" | "page";

export interface RoutePathTarget {
  kind: RoutePathTargetKind;
  owner: string;
  parentPath?: string;
  path: string;
  segments: readonly PluginRouteSegment[];
}

export interface AssertRoutePathsMatchRoutesOptions {
  routes: readonly RoutePathTarget[];
  translator: RoutePathTranslator;
}

interface RouteGroup {
  claimsUrl: boolean;
  key: string;
  label: RoutePathTarget;
  segments: readonly PluginRouteSegment[];
}

type Translations = ReadonlyMap<string, CompiledRoutePath>;

const MAX_SUGGESTIONS = 3;

const keyOf = (segments: readonly PluginRouteSegment[]): string =>
  routeMatchKey([...segments]);

const pathOf = (segments: readonly PluginRouteSegment[]): string =>
  formatRoutePath([...segments]);

const describeEntry = (entry: CompiledRoutePath): string =>
  `i18n.routePaths.${entry.locale}["${entry.sourcePath}"] = "${entry.publicPath}"`;

const staticValue = (value: string): string =>
  value.normalize("NFC").toLowerCase();

const sameSegment = (a: PluginRouteSegment, b: PluginRouteSegment): boolean => {
  if (a.kind === "static" && b.kind === "static") {
    return staticValue(a.value) === staticValue(b.value);
  }
  if (a.kind === "param" && b.kind === "param") return a.name === b.name;

  return a.kind === "splat" && b.kind === "splat";
};

const startsWithSegments = (
  segments: readonly PluginRouteSegment[],
  prefix: readonly PluginRouteSegment[],
): boolean =>
  prefix.length <= segments.length &&
  prefix.every((segment, index) => sameSegment(segments[index], segment));

const patternsOverlap = (
  a: readonly PluginRouteSegment[],
  b: readonly PluginRouteSegment[],
): boolean => {
  for (let index = 0; ; index += 1) {
    const left = a.at(index);
    const right = b.at(index);

    if (left?.kind === "splat" || right?.kind === "splat") return true;
    if (left === undefined || right === undefined) {
      return left === undefined && right === undefined;
    }
    if (
      left.kind === "static" &&
      right.kind === "static" &&
      staticValue(left.value) !== staticValue(right.value)
    ) {
      return false;
    }
  }
};

const routerPrefers = (
  preferred: readonly PluginRouteSegment[],
  other: readonly PluginRouteSegment[],
): boolean => compareRouteSpecificity(preferred, other) < 0;

const editDistance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];

    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[b.length];
};

const firstStatic = (
  segments: readonly PluginRouteSegment[],
): string | undefined => {
  const [first] = segments;

  return first?.kind === "static" ? staticValue(first.value) : undefined;
};

const suggestionsFor = (
  entry: CompiledRoutePath,
  groups: readonly RouteGroup[],
): RouteGroup[] => {
  const first = firstStatic(entry.sourceSegments);
  const sameSection = groups.filter(
    group => first !== undefined && firstStatic(group.segments) === first,
  );
  const candidates = sameSection.length > 0 ? sameSection : groups;

  return candidates
    .map(group => ({
      distance: editDistance(entry.sourcePath, pathOf(group.segments)),
      group,
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ group }) => group);
};

const groupRoutes = (
  routes: readonly RoutePathTarget[],
): Map<string, RouteGroup> => {
  const groups = new Map<string, RouteGroup>();

  for (const route of routes) {
    const key = keyOf(route.segments);
    const existing = groups.get(key);
    const claimsUrl = route.kind !== "layout";

    if (existing === undefined) {
      groups.set(key, {
        claimsUrl,
        key,
        label: route,
        segments: route.segments,
      });
      continue;
    }

    if (claimsUrl && !existing.claimsUrl) existing.label = route;
    existing.claimsUrl ||= claimsUrl;
  }

  return groups;
};

const assertKnownSource = (
  entry: CompiledRoutePath,
  groups: ReadonlyMap<string, RouteGroup>,
): RouteGroup => {
  const group = groups.get(keyOf(entry.sourceSegments));
  if (group !== undefined) return group;

  const suggestions = suggestionsFor(entry, [...groups.values()]);
  const hint =
    suggestions.length === 0
      ? "This app has no localizable routes at all."
      : `Did you mean ${suggestions.map(suggestion => `"${pathOf(suggestion.segments)}" (${suggestion.label.owner})`).join(", ")}?`;

  throw new LocaleRoutingConfigError(
    `${describeEntry(entry)} translates "${entry.sourcePath}", which is not a route in this app. Keys are the English paths the routes declare - the ones plugin docs show. ${hint}`,
    {
      code: "unknown-source-path",
      locale: entry.locale,
      sourcePath: entry.sourcePath,
      translatedPath: entry.publicPath,
    },
  );
};

const assertSameParameterNames = (
  entry: CompiledRoutePath,
  group: RouteGroup,
): void => {
  const routePath = pathOf(group.segments);

  for (const [index, segment] of entry.sourceSegments.entries()) {
    const declared = group.segments[index];

    if (
      segment.kind !== "param" ||
      declared.kind !== "param" ||
      segment.name === declared.name
    ) {
      continue;
    }

    throw new LocaleRoutingConfigError(
      `${describeEntry(entry)} calls the parameter ":${segment.name}", but ${group.label.owner} names it ":${declared.name}". Write the key as "${routePath}" and keep ":${declared.name}" in the translation.`,
      {
        code: "parameter-mismatch",
        conflictsWith: routePath,
        locale: entry.locale,
        sourcePath: entry.sourcePath,
        translatedPath: entry.publicPath,
      },
    );
  }
};

const spellingOf = (
  group: RouteGroup,
  translations: Translations,
): readonly PluginRouteSegment[] =>
  translations.get(group.key)?.publicSegments ?? group.segments;

const assertConsistentLayouts = (
  locale: string,
  routes: readonly RoutePathTarget[],
  groups: ReadonlyMap<string, RouteGroup>,
  translations: Translations,
): void => {
  const byPath = new Map<string, RoutePathTarget>();

  for (const route of routes) {
    if (!byPath.has(route.path) || route.kind === "layout") {
      byPath.set(route.path, route);
    }
  }

  for (const route of routes) {
    if (route.parentPath === undefined) continue;

    const parent = byPath.get(route.parentPath);
    const parentGroup = parent && groups.get(keyOf(parent.segments));
    const childGroup = groups.get(keyOf(route.segments));
    if (!parent || !parentGroup || !childGroup) continue;

    const parentSpelling = spellingOf(parentGroup, translations);
    const childSpelling = spellingOf(childGroup, translations);
    if (startsWithSegments(childSpelling, parentSpelling)) continue;

    const parentEntry = translations.get(parentGroup.key);
    const childEntry = translations.get(childGroup.key);
    const parentPublic = pathOf(parentSpelling);

    if (parentEntry !== undefined && childEntry === undefined) {
      const suggestion = pathOf([
        ...parentEntry.publicSegments,
        ...route.segments.slice(parent.segments.length),
      ]);

      throw new LocaleRoutingConfigError(
        `i18n.routePaths.${locale} translates the layout "${parent.path}" to "${parentPublic}", but not ${route.owner}, which is inside it. Every route under a translated layout has to be translated under its prefix - add "${route.path}": "${suggestion}" (or another spelling starting with "${parentPublic}").`,
        {
          code: "inconsistent-layout-path",
          conflictsWith: parent.path,
          locale,
          sourcePath: route.path,
          translatedPath: parentEntry.publicPath,
        },
      );
    }

    if (childEntry === undefined) continue;

    throw new LocaleRoutingConfigError(
      `${describeEntry(childEntry)} does not start with "${parentPublic}", the ${locale} URL of its layout "${parent.path}" (${parent.owner}). A route inside a layout keeps the layout's prefix - spell "${route.path}" under "${parentPublic}"${parentEntry ? "" : `, or translate the layout "${parent.path}" too`}.`,
      {
        code: "inconsistent-layout-path",
        conflictsWith: parent.path,
        locale,
        sourcePath: childEntry.sourcePath,
        translatedPath: childEntry.publicPath,
      },
    );
  }
};

const assertNoCollisions = (
  locale: string,
  groups: readonly RouteGroup[],
  translations: Translations,
): void => {
  const spelledBy = new Map<string, RouteGroup>();

  for (const group of groups) {
    if (!group.claimsUrl) continue;

    const key = keyOf(spellingOf(group, translations));
    const existing = spelledBy.get(key);

    if (existing === undefined) {
      spelledBy.set(key, group);
      continue;
    }

    const translated = translations.has(group.key) ? group : existing;
    const other = translated === group ? existing : group;
    const entry = translations.get(translated.key);
    if (entry === undefined) continue;

    const otherEntry = translations.get(other.key);
    const otherPath = pathOf(other.segments);
    const otherSpelling = otherEntry
      ? `which is the ${locale} URL of "${otherPath}" (${other.label.owner})`
      : `which is where ${other.label.owner} already answers - it is not translated for "${locale}", so it keeps its English path`;

    throw new LocaleRoutingConfigError(
      `${describeEntry(entry)} spells the same URLs as "${pathOf(spellingOf(other, translations))}", ${otherSpelling}. One public URL can only reach one route - give one of them a different spelling.`,
      {
        code: "route-collision",
        conflictsWith: otherPath,
        locale,
        sourcePath: entry.sourcePath,
        translatedPath: entry.publicPath,
      },
    );
  }
};

const assertNoShadowing = (
  locale: string,
  groups: readonly RouteGroup[],
  translations: Translations,
): void => {
  const untranslated = groups.filter(
    group => group.claimsUrl && !translations.has(group.key),
  );

  for (const entry of translations.values()) {
    for (const group of untranslated) {
      const routePath = pathOf(group.segments);
      const details = {
        code: "route-shadowed" as const,
        conflictsWith: routePath,
        locale,
        sourcePath: entry.sourcePath,
        translatedPath: entry.publicPath,
      };

      if (
        patternsOverlap(group.segments, entry.publicSegments) &&
        routerPrefers(group.segments, entry.publicSegments)
      ) {
        throw new LocaleRoutingConfigError(
          `${describeEntry(entry)} also matches "${routePath}", the ${locale} URL of ${group.label.owner}, which is not translated. A router would send "${routePath}" to that more specific route, but the translation rewrites it to "${rewriteThrough(group.segments, entry.publicSegments, entry.sourceSegments)}" first. Translate "${routePath}" too, or choose a spelling that does not overlap it.`,
          details,
        );
      }

      if (
        patternsOverlap(group.segments, entry.sourceSegments) &&
        routerPrefers(group.segments, entry.sourceSegments)
      ) {
        throw new LocaleRoutingConfigError(
          `${group.label.owner} is not translated for "${locale}", but ${describeEntry(entry)} matches "${routePath}" too, so its ${locale} URL would become "${rewriteThrough(group.segments, entry.sourceSegments, entry.publicSegments)}" through that pattern. Translate "${routePath}" too (an identity entry "${routePath}": "${routePath}" keeps it English).`,
          details,
        );
      }
    }
  }
};

const rewriteThrough = (
  segments: readonly PluginRouteSegment[],
  from: readonly PluginRouteSegment[],
  to: readonly PluginRouteSegment[],
): string => {
  const captures = new Map<string, readonly PluginRouteSegment[]>();

  for (const [index, part] of from.entries()) {
    if (part.kind === "splat") {
      captures.set("*", segments.slice(index));
      break;
    }
    if (part.kind === "param") captures.set(part.name, [segments[index]]);
  }

  return pathOf(
    to.flatMap(part => {
      if (part.kind === "static") return [part];
      if (part.kind === "param") return captures.get(part.name) ?? [];

      return captures.get("*") ?? [];
    }),
  );
};

const entriesByLocale = (
  entries: readonly CompiledRoutePath[],
): Map<string, CompiledRoutePath[]> => {
  const byLocale = new Map<string, CompiledRoutePath[]>();

  for (const entry of entries) {
    byLocale.set(entry.locale, [...(byLocale.get(entry.locale) ?? []), entry]);
  }

  return byLocale;
};

export const assertRoutePathsMatchRoutes = ({
  routes,
  translator,
}: AssertRoutePathsMatchRoutesOptions): void => {
  if (translator.entries.length === 0) return;

  const groups = groupRoutes(routes);
  const groupList = [...groups.values()];

  for (const [locale, entries] of entriesByLocale(translator.entries)) {
    const translations = new Map<string, CompiledRoutePath>();

    for (const entry of entries) {
      const group = assertKnownSource(entry, groups);

      assertSameParameterNames(entry, group);
      translations.set(group.key, entry);
    }

    assertConsistentLayouts(locale, routes, groups, translations);
    assertNoCollisions(locale, groupList, translations);
    assertNoShadowing(locale, groupList, translations);
  }
};
