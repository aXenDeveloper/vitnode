import type { ContentContainerDefinition } from "./types";

export const isContentContainerDefinition = (
  value: unknown,
): value is ContentContainerDefinition =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "contentContainer";
