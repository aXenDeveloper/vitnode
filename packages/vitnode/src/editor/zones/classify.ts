import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorZoneInvalidEntry } from "../state/types";

import { isBlockInstance } from "../../blocks/instance";

export interface ClassifiedZoneEntries {
  blocks: AnyBlockInstance[];
  invalid: EditorZoneInvalidEntry[];
}

const DESCRIPTION_MAX_LENGTH = 120;

export const classifyZoneEntries = (
  values: null | readonly unknown[] | undefined,
): ClassifiedZoneEntries => {
  const blocks: AnyBlockInstance[] = [];
  const invalid: EditorZoneInvalidEntry[] = [];
  const seen = new Set<string>();

  (values ?? []).forEach((value, index) => {
    if (!isBlockInstance(value) || seen.has(value.id)) {
      invalid.push({ index, value });

      return;
    }

    seen.add(value.id);
    blocks.push(value);
  });

  return { blocks, invalid };
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
