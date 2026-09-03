export type JsonSchemaLike = Record<string, unknown>;

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const typeOf = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  return typeof value;
};

const resolveRef = (
  schema: JsonSchemaLike,
  document: JsonSchemaLike,
): JsonSchemaLike => {
  const ref = schema.$ref;
  if (typeof ref !== "string") return schema;

  const path = ref.replace(/^#\//, "").split("/");
  let current: unknown = document;
  for (const segment of path) {
    current = (current as Record<string, unknown> | undefined)?.[segment];
  }

  return (current as JsonSchemaLike | undefined) ?? {};
};

export const validateAgainstJsonSchema = (
  value: unknown,
  rawSchema: JsonSchemaLike,
  document: JsonSchemaLike = {},
  path = "",
): string[] => {
  const schema = resolveRef(rawSchema, document);
  const at = path === "" ? "(root)" : path;
  const issues: string[] = [];

  const branches = ["oneOf", "anyOf"] as const;
  for (const key of branches) {
    const options = schema[key];
    if (!Array.isArray(options)) continue;

    const matched = options.some(
      option =>
        validateAgainstJsonSchema(
          value,
          option as JsonSchemaLike,
          document,
          path,
        ).length === 0,
    );

    return matched ? [] : [`${at}: matched none of ${key}`];
  }

  if (Array.isArray(schema.allOf)) {
    for (const option of schema.allOf) {
      issues.push(
        ...validateAgainstJsonSchema(
          value,
          option as JsonSchemaLike,
          document,
          path,
        ),
      );
    }
  }

  if (value === null) {
    // OpenAPI 3.0 spells nullability as a sibling flag rather than as a type,
    // which is why this is not simply `type.includes("null")`.
    return schema.nullable === true || schema.type === undefined
      ? issues
      : [...issues, `${at}: null, but the document does not allow it`];
  }

  const expected = schema.type;
  if (typeof expected === "string") {
    const actual = typeOf(value);
    const ok =
      expected === "integer"
        ? actual === "number" && Number.isInteger(value)
        : expected === "number"
          ? actual === "number"
          : actual === expected;

    if (!ok) {
      return [...issues, `${at}: expected ${expected}, got ${actual}`];
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    issues.push(`${at}: ${JSON.stringify(value)} is not one of the enum`);
  }

  if (
    schema.format === "date-time" &&
    typeof value === "string" &&
    !ISO_DATE_TIME.test(value)
  ) {
    issues.push(`${at}: "${value}" is not an ISO date-time`);
  }

  if (expected === "array" && Array.isArray(value)) {
    const items = schema.items as JsonSchemaLike | undefined;
    if (items) {
      value.forEach((entry, index) => {
        issues.push(
          ...validateAgainstJsonSchema(
            entry,
            items,
            document,
            `${path}[${index}]`,
          ),
        );
      });
    }
  }

  if (expected === "object" || (expected === undefined && schema.properties)) {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<
      string,
      JsonSchemaLike
    >;
    const required = Array.isArray(schema.required)
      ? (schema.required as string[])
      : [];

    for (const name of required) {
      if (!(name in object))
        issues.push(`${at}.${name}: missing, but required`);
    }

    for (const [name, entry] of Object.entries(object)) {
      const property = properties[name];
      if (!property) {
        // `additionalProperties: false` is what a strict object emits, and a key
        // the document does not describe is a field a generated client will
        // silently drop - or, on a public route, a field nobody meant to ship.
        if (schema.additionalProperties === false) {
          issues.push(`${at}.${name}: not described by the document`);
        }
        continue;
      }

      issues.push(
        ...validateAgainstJsonSchema(
          entry,
          property,
          document,
          path === "" ? name : `${path}.${name}`,
        ),
      );
    }
  }

  return issues;
};
