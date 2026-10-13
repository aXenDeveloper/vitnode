import type { ContentContainerDefinition } from "./types";

/** Tells a `defineContentContainer` result apart from anything else. Dependency-free on purpose. */
export const isContentContainerDefinition = (
  value: unknown,
): value is ContentContainerDefinition =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "contentContainer";
