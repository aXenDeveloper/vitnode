import type {
  Expression,
  ObjectExpression,
  ObjectProperty,
  ObjectPropertyKind,
} from "oxc-parser";

import { unwrap } from "./ast";

export type EffectiveProperty =
  | { at: number; kind: "unsafe"; reason: string }
  | { kind: "absent" }
  | { kind: "property"; property: ObjectProperty };

const staticKey = (property: ObjectProperty): null | string => {
  const { key } = property;

  if (!property.computed) {
    if (key.type === "Identifier") return key.name;
    if (key.type === "Literal") return String(key.value);

    return null;
  }

  const value = unwrap(key as Expression);
  if (value.type === "Literal" && typeof value.value === "string") {
    return value.value;
  }
  if (
    value.type === "TemplateLiteral" &&
    value.expressions.length === 0 &&
    value.quasis.length === 1
  ) {
    return value.quasis[0]?.value.cooked ?? null;
  }

  return null;
};

const spreadMaySet = (
  element: Extract<ObjectPropertyKind, { type: "SpreadElement" }>,
  key: string,
): boolean => {
  const argument = unwrap(element.argument);
  if (argument.type !== "ObjectExpression") return true;

  return effectiveProperty(argument, key).kind !== "absent";
};

export const effectiveProperty = (
  object: ObjectExpression,
  key: string,
): EffectiveProperty => {
  let selected: null | ObjectProperty = null;
  let override: null | { at: number; what: string } = null;

  for (const entry of object.properties) {
    if (entry.type === "SpreadElement") {
      if (spreadMaySet(entry, key)) {
        override ??= { at: entry.start, what: "a spread" };
      }
      continue;
    }

    const name = staticKey(entry);
    if (name === null) {
      override ??= { at: entry.start, what: "a computed key" };
      continue;
    }
    if (name !== key) continue;

    if (entry.kind !== "init" || entry.method) {
      selected = null;
      override = {
        at: entry.start,
        what: `a ${entry.method ? "method" : entry.kind === "get" ? "getter" : "setter"} named ${key}`,
      };
      continue;
    }

    selected = entry;
    override = null;
  }

  if (override !== null) {
    return {
      at: override.at,
      kind: "unsafe",
      reason:
        selected === null
          ? `${key} is not a plain property here, and ${override.what} may supply it - adding one before that could be overridden, adding one after it would drop what it supplies`
          : `${override.what} after ${key} may replace it`,
    };
  }

  return selected === null
    ? { kind: "absent" }
    : { kind: "property", property: selected };
};
