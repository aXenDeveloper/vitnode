import type { Context, TypedResponse } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONParsed } from "hono/utils/types";
import type { z } from "zod";

import { formatSchemaIssues, isPlainObject } from "./json-wire";

/**
 * Thrown by {@link projectResponse} and {@link respondJson} when a value does
 * not match its response schema, or the schema cannot be projected. It is the
 * server breaking its own contract, so it surfaces as a 500, never a 400. The
 * message names paths, issue codes and schema types, never values.
 */
export class ResponseProjectionError extends Error {
  constructor(reason: string) {
    super(`The response does not match its schema: ${reason}`);
    this.name = "ResponseProjectionError";
    this.reason = reason;
  }

  readonly reason: string;
}

interface SchemaDef {
  readonly element?: z.ZodType;
  readonly innerType?: z.ZodType;
  readonly items?: readonly z.ZodType[];
  readonly options?: readonly z.ZodType[];
  readonly rest?: null | z.ZodType;
  readonly shape?: Readonly<Record<string, z.ZodType>>;
  readonly type: string;
  readonly valueType?: z.ZodType;
}

const defOf = (schema: z.ZodType): SchemaDef =>
  (schema as unknown as { def: SchemaDef }).def;

const LEAVES = new Set([
  "any",
  "boolean",
  "date",
  "enum",
  "literal",
  "never",
  "null",
  "number",
  "string",
  "template_literal",
  "undefined",
  "unknown",
  "void",
]);
const WRAPPERS = new Set(["nonoptional", "nullable", "optional", "readonly"]);
const CONTAINERS = new Set(["array", "object", "record", "tuple", "union"]);

const children = (
  def: SchemaDef,
  path: string,
): (readonly [z.ZodType, string])[] => {
  switch (def.type) {
    case "array":
      return def.element ? [[def.element, `${path}[]`]] : [];
    case "object":
      return Object.entries(def.shape ?? {}).map(
        ([key, field]) => [field, `${path}.${key}`] as const,
      );
    case "record":
      return def.valueType ? [[def.valueType, `${path}{}`]] : [];
    case "tuple":
      return [...(def.items ?? []), ...(def.rest ? [def.rest] : [])].map(
        (item, index) => [item, `${path}[${String(index)}]`] as const,
      );
    case "union":
      return (def.options ?? []).map(option => [option, path] as const);
    default:
      return def.innerType ? [[def.innerType, path]] : [];
  }
};

const unsupported = (
  schema: z.ZodType,
  path: string,
  visiting: Set<z.ZodType>,
): null | string => {
  if (visiting.has(schema))
    return `${path}: recursive schemas cannot be projected`;

  const def = defOf(schema);
  if (
    !LEAVES.has(def.type) &&
    !WRAPPERS.has(def.type) &&
    !CONTAINERS.has(def.type)
  ) {
    return `${path}: "${def.type}" schemas cannot be projected - use plain JSON schemas without transforms or defaults`;
  }

  visiting.add(schema);
  try {
    for (const [child, childPath] of children(def, path)) {
      const reason = unsupported(child, childPath, visiting);
      if (reason !== null) return reason;
    }

    return null;
  } finally {
    visiting.delete(schema);
  }
};

const projectable = new WeakSet<z.ZodType>();

class ProjectionMismatch extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProjectionMismatch";
  }
}

const accepts = (option: z.ZodType, value: unknown, path: string): boolean => {
  try {
    return option.safeParse(value).success;
  } catch {
    throw new ResponseProjectionError(
      `${path}: a union option could not be validated synchronously`,
    );
  }
};

const project = (schema: z.ZodType, value: unknown, path: string): unknown => {
  const def = defOf(schema);

  switch (def.type) {
    case "array": {
      const element = def.element;
      if (!Array.isArray(value)) {
        throw new ProjectionMismatch(`${path}: expected an array`);
      }

      return element
        ? Array.from({ length: value.length }, (_, index) =>
            project(element, value[index], `${path}[${String(index)}]`),
          )
        : value;
    }
    case "object": {
      if (!isPlainObject(value)) {
        throw new ProjectionMismatch(`${path}: expected a plain object`);
      }
      const result: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(def.shape ?? {})) {
        if (Object.hasOwn(value, key) && value[key] !== undefined) {
          result[key] = project(field, value[key], `${path}.${key}`);
        }
      }

      return result;
    }
    case "record": {
      if (!isPlainObject(value)) {
        throw new ProjectionMismatch(`${path}: expected a plain object`);
      }
      const valueType = def.valueType;
      if (!valueType) return { ...value };

      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          project(valueType, item, `${path}{}`),
        ]),
      );
    }
    case "tuple":
      if (!Array.isArray(value)) {
        throw new ProjectionMismatch(`${path}: expected an array`);
      }

      return Array.from({ length: value.length }, (_, index) => {
        const itemSchema = def.items?.[index] ?? def.rest;
        const item: unknown = value[index];

        return itemSchema
          ? project(itemSchema, item, `${path}[${String(index)}]`)
          : item;
      });
    case "union": {
      for (const option of def.options ?? []) {
        let projected: unknown;
        try {
          projected = project(option, value, path);
        } catch (error) {
          if (error instanceof ProjectionMismatch) continue;
          throw error;
        }
        if (accepts(option, projected, path)) return projected;
      }

      throw new ProjectionMismatch(
        `${path}: no union option accepts the projected value`,
      );
    }
    default:
      if (WRAPPERS.has(def.type) && def.innerType) {
        return value === undefined || value === null
          ? value
          : project(def.innerType, value, path);
      }

      return value;
  }
};

const parseSynchronously = <Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
) => {
  try {
    return schema.safeParse(value);
  } catch {
    throw new ResponseProjectionError(
      "response: async schemas cannot be projected",
    );
  }
};

/**
 * Copies only what `schema` declares out of `value`: undeclared object keys
 * are dropped at every depth (through arrays, records, tuples, optional and
 * nullable fields, and the first union option that accepts its projected
 * result), even when the schema is `z.looseObject` or has a `catchall`.
 * Missing optional fields stay missing; nothing is filled in. The result is
 * then validated with `schema` and returned as its output.
 *
 * An object schema only accepts plain objects (or `Object.create(null)`):
 * a class instance is refused rather than copied. A union whose options all
 * reject their projected value is refused; the original value is never sent.
 *
 * Projection removes fields; it does not decide who may see them. Check
 * access before building the value.
 *
 * Universal. Use {@link respondJson} in a route handler.
 *
 * @throws {ResponseProjectionError} When the schema transforms, pipes, fills
 * defaults, recurses or is async, an object schema meets a non-plain object,
 * no union option fits, or the projected value does not match it.
 */
export const projectResponse = <Schema extends z.ZodType>(
  schema: Schema,
  value: z.output<Schema>,
): z.output<Schema> => {
  if (!projectable.has(schema)) {
    const reason = unsupported(schema, "response", new Set());
    if (reason !== null) throw new ResponseProjectionError(reason);
    projectable.add(schema);
  }

  let projected: unknown;
  try {
    projected = project(schema, value, "response");
  } catch (error) {
    if (error instanceof ProjectionMismatch) {
      throw new ResponseProjectionError(error.message);
    }
    throw error;
  }
  const parsed = parseSynchronously(schema, projected);
  if (!parsed.success) {
    throw new ResponseProjectionError(
      formatSchemaIssues(parsed.error.issues, "response"),
    );
  }

  return parsed.data;
};

/**
 * `c.json(projectResponse(schema, value), status)`: answers with only the
 * fields `schema` declares. Pass the same schema the route declares for
 * `status`, and the handler keeps its typed response, so the fetcher infers
 * the body exactly as with `c.json`. Headers and cookies set on `c` are kept.
 *
 * @throws {ResponseProjectionError} See {@link projectResponse}.
 *
 * @example
 * ```ts
 * import { respondJson } from "@vitnode/core/api/lib/respond-json";
 *
 * handler: async c => {
 *   const [note] = await c.get("db").select().from(site_notes).limit(1);
 *
 *   return respondJson(c, 200, zodNote, note); // drops columns zodNote does not declare
 * },
 * ```
 */
export const respondJson = <
  Schema extends z.ZodType,
  Status extends ContentfulStatusCode,
>(
  c: Context,
  status: Status,
  schema: Schema,
  value: z.output<Schema>,
): Response & TypedResponse<JSONParsed<z.output<Schema>>, Status, "json"> =>
  c.json(projectResponse(schema, value), status);
