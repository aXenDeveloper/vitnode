import type { z } from "zod";

/**
 * A value that survives `JSON.stringify` unchanged: what a typed queue task,
 * cache entry or event accepts before validation. An object property may be
 * `undefined` - it is omitted, exactly as JSON drops it.
 */
export type JsonWireInput =
  | boolean
  | null
  | number
  | readonly JsonWireInput[]
  | string
  | { readonly [key: string]: JsonWireInput | undefined };

/** A JSON object, the shape of a queue or event payload on the wire. */
export type JsonWireObject = Readonly<
  Record<string, JsonWireInput | undefined>
>;

/**
 * `unknown` when `Schema`'s input is JSON, otherwise an object type naming the
 * problem. Intersect a schema parameter with it (`schema: S & JsonWireInputCheck<S>`)
 * to reject `z.date()`, `z.map()` and friends at compile time.
 */
export type JsonWireInputCheck<Schema extends z.ZodType> =
  z.input<Schema> extends JsonWireInput
    ? unknown
    : {
        readonly "The schema's input must be JSON - use z.iso.datetime() instead of z.date()": z.input<Schema>;
      };

/**
 * {@link JsonWireInputCheck} for a payload: the schema's input must be a JSON
 * object and its output an object.
 */
export type JsonWireObjectCheck<Schema extends z.ZodType> =
  z.input<Schema> extends JsonWireObject
    ? z.output<Schema> extends Record<string, unknown>
      ? unknown
      : {
          readonly "The schema's output must be an object": z.output<Schema>;
        }
    : {
        readonly "The schema's input must be a JSON object - use z.iso.datetime() instead of z.date()": z.input<Schema>;
      };

/**
 * Thrown when a value cannot be written as JSON without changing it: a `Date`,
 * a `Map`, a class instance, `NaN`, `Infinity`, a `bigint`, a function, a
 * circular reference, or an `undefined` or missing (sparse) array item. The
 * message names the path, never the value.
 */
export class JsonWireError extends TypeError {
  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "JsonWireError";
    this.path = path;
  }

  readonly path: string;
}

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const describe = (value: object): string => {
  const name = (
    Object.getPrototypeOf(value) as null | { constructor?: { name?: string } }
  )?.constructor?.name;

  return name ? `a ${name}` : "not a plain object";
};

const pathOf = (path: string, key: number | string): string =>
  typeof key === "number"
    ? `${path}[${String(key)}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

const toWire = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): JsonWireInput => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new JsonWireError(path, "is not a finite number");
    }

    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new JsonWireError(
      path,
      value === undefined ? "is undefined" : `is a ${typeof value}`,
    );
  }
  if (ancestors.has(value)) {
    throw new JsonWireError(path, "is a circular reference");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items: JsonWireInput[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) {
          throw new JsonWireError(
            pathOf(path, index),
            "is a missing array item - JSON would turn it into null",
          );
        }
        const item: unknown = value[index];
        if (item === undefined) {
          throw new JsonWireError(
            pathOf(path, index),
            "is undefined - JSON would turn it into null",
          );
        }
        items.push(toWire(item, pathOf(path, index), ancestors));
      }

      return items;
    }

    if (!isPlainObject(value)) {
      throw new JsonWireError(
        path,
        value instanceof Date
          ? "is a Date - send an ISO string (z.iso.datetime()) instead"
          : `is ${describe(value)}, not a plain object`,
      );
    }

    const result: Record<string, JsonWireInput> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = toWire(item, pathOf(path, key), ancestors);
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
};

/**
 * Copies `value` into the exact JSON it would be stored as, or throws a
 * {@link JsonWireError} instead of letting `JSON.stringify` silently change
 * it (a `Date` becoming a string, `NaN` becoming `null`, a `Map` becoming
 * `{}`). Object properties set to `undefined` are omitted. Universal.
 *
 * @param label How the value is named in an error, e.g. `payload`.
 */
export const toJsonWire = (value: unknown, label = "value"): JsonWireInput =>
  toWire(value, label, new Set());

/**
 * A schema failure as safe text: each issue's path and code (and the expected
 * type), never the value or a custom message that might quote it.
 */
export const formatSchemaIssues = (
  issues: readonly z.core.$ZodIssue[],
  label = "value",
): string => {
  const shown = issues.slice(0, 5).map(issue => {
    const path = issue.path.reduce<string>(
      (acc, key) => pathOf(acc, typeof key === "symbol" ? String(key) : key),
      label,
    );
    const expected =
      issue.code === "invalid_type" ? ` (expected ${issue.expected})` : "";

    return `${path}: ${issue.code}${expected}`;
  });
  const more = issues.length - shown.length;

  return more > 0
    ? `${shown.join("; ")}; and ${String(more)} more`
    : shown.join("; ");
};

export type JsonWireParseResult<Output> =
  | { data: Output; success: true; wire: JsonWireInput }
  | { reason: string; success: false };

/**
 * The shared boundary of typed queue tasks, cache entries and events: copies
 * `input` to its JSON wire form ({@link toJsonWire}), then parses that wire
 * with `schema` (`safeParseAsync`, so async refinements work). On success,
 * `wire` is what to store or send and `data` is the schema's output; on
 * failure, `reason` is safe to log ({@link formatSchemaIssues}).
 */
export const parseJsonWire = async <Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  label = "value",
): Promise<JsonWireParseResult<z.output<Schema>>> => {
  let wire: JsonWireInput;
  try {
    wire = toJsonWire(input, label);
  } catch (error) {
    if (error instanceof JsonWireError) {
      return { reason: error.message, success: false };
    }
    throw error;
  }

  const parsed = await schema.safeParseAsync(wire);

  return parsed.success
    ? { data: parsed.data, success: true, wire }
    : {
        reason: formatSchemaIssues(parsed.error.issues, label),
        success: false,
      };
};
