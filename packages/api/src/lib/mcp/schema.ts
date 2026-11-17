import type { z } from "zod";

import { toJSONSchema } from "zod";

/** A JSON Schema document, as MCP carries it. */
export type McpJsonSchema = Record<string, unknown>;

/** Thrown when a route's schema has no faithful JSON Schema form. */
export class McpSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpSchemaError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const UNREPRESENTABLE_OUTPUT = new Set([
  "bigint",
  "custom",
  "function",
  "map",
  "nan",
  "promise",
  "set",
  "symbol",
  "transform",
  "undefined",
  "void",
]);

const zodType = (schema: unknown): string | undefined => {
  const def = (schema as { _zod?: { def?: { type?: unknown } } })._zod?.def;

  return typeof def?.type === "string" ? def.type : undefined;
};

/**
 * The JSON-wire view of what a route accepts: coercions and transforms show
 * their input side, which is what a caller sends. Anything with no JSON form
 * (a custom type, a date, a file) throws - the route's own validation stays
 * the authority, but an unconstrained stand-in would be a lie to the model.
 */
export const requestJsonSchema = (
  schema: z.ZodType,
  where: string,
): McpJsonSchema => {
  try {
    return toJSONSchema(schema, {
      io: "input",
      target: "draft-2020-12",
      unrepresentable: "throw",
    });
  } catch (error) {
    throw new McpSchemaError(
      `${where} has no JSON Schema form (${error instanceof Error ? error.message : String(error)}). Use JSON-compatible types in it, or leave the route off MCP.`,
    );
  }
};

/**
 * The JSON-wire view of what a route returns: dates as `date-time` strings,
 * the way `c.json()` serializes them. `undefined` when part of it cannot be
 * described (a transform, a custom type) - a tool then simply has no
 * `outputSchema`.
 *
 * Objects are left open (`additionalProperties` is dropped): a response schema
 * documents the fields a route returns, and Hono does not strip the others.
 */
export const responseJsonSchema = (
  schema: z.ZodType,
): McpJsonSchema | undefined => {
  let representable = true;

  const json = toJSONSchema(schema, {
    io: "output",
    target: "draft-2020-12",
    unrepresentable: "any",
    override: ctx => {
      const type = zodType(ctx.zodSchema);
      if (type === "date") {
        ctx.jsonSchema.type = "string";
        ctx.jsonSchema.format = "date-time";
      } else if (type && UNREPRESENTABLE_OUTPUT.has(type)) {
        representable = false;
      }
    },
  }) as McpJsonSchema;

  return representable ? openObjects(json) : undefined;
};

const openObjects = (schema: unknown): McpJsonSchema => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!isRecord(node)) return node;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "additionalProperties" && value === false) continue;
      result[key] = visit(value);
    }

    return result;
  };

  return visit(schema) as McpJsonSchema;
};

/**
 * Moves a child document's `$defs` to the root it is nested into, renaming
 * nothing: two children defining one name differently is refused, since the
 * references could no longer tell them apart.
 */
export const nestJsonSchemas = (
  children: Record<string, McpJsonSchema>,
  where: string,
): { $defs?: Record<string, unknown>; properties: Record<string, unknown> } => {
  const defs: Record<string, unknown> = {};
  const properties: Record<string, unknown> = {};

  for (const [name, child] of Object.entries(children)) {
    const { $defs, $schema: _dialect, ...rest } = child;
    if (isRecord($defs)) {
      for (const [id, definition] of Object.entries($defs)) {
        if (
          id in defs &&
          JSON.stringify(defs[id]) !== JSON.stringify(definition)
        ) {
          throw new McpSchemaError(
            `${where} uses two different schemas with the id "${id}".`,
          );
        }
        defs[id] = definition;
      }
    }
    properties[name] = rest;
  }

  return Object.keys(defs).length > 0
    ? { $defs: defs, properties }
    : { properties };
};

const SCALAR_TYPES = new Set(["boolean", "integer", "number", "string"]);

/**
 * Whether a property can travel as one URL value: a string, number, integer
 * or boolean, or an enum or constant of them. Arrays, objects, `null` and
 * unconstrained values cannot - the API has no single agreed way to put them
 * in a URL.
 */
export const isScalarJsonSchema = (schema: unknown): boolean => {
  if (!isRecord(schema)) return false;

  const variants = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(variants)) {
    return variants.length > 0 && variants.every(isScalarJsonSchema);
  }

  if (Array.isArray(schema.enum)) {
    return (
      schema.enum.length > 0 &&
      schema.enum.every(value =>
        ["boolean", "number", "string"].includes(typeof value),
      )
    );
  }

  if ("const" in schema) {
    return ["boolean", "number", "string"].includes(typeof schema.const);
  }

  return typeof schema.type === "string" && SCALAR_TYPES.has(schema.type);
};

/** The `required` names of an object schema. */
export const requiredOf = (schema: McpJsonSchema): string[] =>
  Array.isArray(schema.required)
    ? schema.required.filter((name): name is string => typeof name === "string")
    : [];

/** The property schemas of an object schema. */
export const propertiesOf = (schema: McpJsonSchema): Record<string, unknown> =>
  isRecord(schema.properties) ? schema.properties : {};
