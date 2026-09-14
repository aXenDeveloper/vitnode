/**
 * The message namespaces the two discovery screens declare.
 *
 * Their own module because `routes.tsx` names them: a route tree is read by the
 * build in Node, and importing them from a loader would pull that loader's query
 * modules along for a pair of string arrays.
 */
export const DISCOVER_NAMESPACES = ["core.global", "core.search"] as const;

export const SEARCH_NAMESPACES = ["core.global", "core.search"] as const;
