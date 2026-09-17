import type { BlockAreaInstance, ContentNode } from "../../blocks/types";
import type { EditorZoneInvalidEntry } from "../state/types";

import { isAreaLike, isBlockAreaInstance } from "../../blocks/area";
import { isBlockInstance } from "../../blocks/instance";

export interface ClassifiedZoneEntries {
  invalid: EditorZoneInvalidEntry[];
  nodes: ContentNode[];
}

const DESCRIPTION_MAX_LENGTH = 120;

const readableArea = (
  value: unknown,
  seen: ReadonlySet<string>,
): BlockAreaInstance | null => {
  if (!isBlockAreaInstance(value) || seen.has(value.id)) return null;

  const ids = new Set([value.id]);

  for (const child of value.children) {
    if (!isBlockInstance(child) || seen.has(child.id) || ids.has(child.id)) {
      return null;
    }

    ids.add(child.id);
  }

  return value;
};

export const classifyZoneEntries = (
  values: null | readonly unknown[] | undefined,
): ClassifiedZoneEntries => {
  const nodes: ContentNode[] = [];
  const invalid: EditorZoneInvalidEntry[] = [];
  const seen = new Set<string>();

  (values ?? []).forEach((value, index) => {
    if (isAreaLike(value)) {
      const area = readableArea(value, seen);

      if (!area) {
        invalid.push({ index, value });

        return;
      }

      seen.add(area.id);
      for (const child of area.children) seen.add(child.id);
      nodes.push(area);

      return;
    }

    if (!isBlockInstance(value) || seen.has(value.id)) {
      invalid.push({ index, value });

      return;
    }

    seen.add(value.id);
    nodes.push(value);
  });

  return { invalid, nodes };
};

const describeObject = (value: object): string => {
  try {
    return JSON.stringify(value) ?? (Array.isArray(value) ? "[]" : "{}");
  } catch {
    return Array.isArray(value) ? "[…]" : "{…}";
  }
};

export const describeInvalidEntry = (value: unknown): string => {
  const described = ((): string => {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "bigint") return `${value.toString()}n`;
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "function") return "function";
    if (typeof value === "object" && value !== null)
      return describeObject(value);

    return String(value);
  })();

  return described.length > DESCRIPTION_MAX_LENGTH
    ? `${described.slice(0, DESCRIPTION_MAX_LENGTH - 1)}…`
    : described;
};
