import type { ParamType, PermissionSource } from "./templates";

import { UserError } from "../errors";
import { localImports } from "./templates";

export interface ResourceField {
  name: string;
  optional: boolean;
  type: ResourceFieldType;
}

export type ResourceFieldType = "boolean" | "int" | "number" | "string";

const FIELD_TYPES: Record<ResourceFieldType, string> = {
  boolean: "z.boolean()",
  int: "z.number().int()",
  number: "z.number()",
  string: "z.string()",
};

const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;

export const parseFields = (input: string): ResourceField[] => {
  const trimmed = input.trim();
  if (trimmed === "") return [];

  const fields = trimmed.split(",").map(part => {
    const match = /^\s*([^:?\s]+)(\?)?\s*:\s*(\S+)\s*$/.exec(part);
    const [, name, optional, type] = match ?? [];

    if (name === undefined || type === undefined) {
      throw new UserError(`"${part.trim()}" is not a field definition.`, {
        details: [
          "Write fields as name:type, separated by commas, e.g. title:string,pinned?:boolean.",
        ],
      });
    }
    if (!FIELD_NAME.test(name) || name === "id") {
      throw new UserError(`"${name}" is not a supported field name.`, {
        details: [
          "Use camelCase starting with a lower-case letter. id is added for you.",
        ],
      });
    }
    if (!Object.hasOwn(FIELD_TYPES, type)) {
      throw new UserError(`"${type}" is not a supported field type.`, {
        hint: `Use one of: ${Object.keys(FIELD_TYPES).join(", ")}.`,
      });
    }

    return {
      name,
      optional: optional === "?",
      type: type as ResourceFieldType,
    };
  });

  const names = fields.map(field => field.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined) {
    throw new UserError(`The field "${duplicate}" is listed twice.`);
  }

  return fields;
};

export interface ResourceNames {
  createSchema: string;
  createType: string;
  factory: string;
  itemSchema: string;
  itemType: string;
  label: string;
  leaf: string;
  notImplementedError: string;
  updateSchema: string;
  updateType: string;
}

const idSchema = (type: ParamType) =>
  type === "number" ? "z.number().int().positive()" : "z.string()";

export const resourceSchemaTemplate = ({
  fields,
  idType,
  names,
}: {
  fields: readonly ResourceField[];
  idType: ParamType;
  names: ResourceNames;
}): string => {
  const line = (field: ResourceField) =>
    `  ${field.name}: ${FIELD_TYPES[field.type]}${field.optional ? ".optional()" : ""},`;
  const note =
    fields.length === 0
      ? `
// Generated without --fields: only the id is modelled. Add the fields your
// ${names.leaf} have to both schemas - the routes and the service follow them.
`
      : "";

  return `import { z } from "@hono/zod-openapi";
${note}
/** One ${names.leaf} entry, as the API returns it. */
export const ${names.itemSchema} = z.object({
  id: ${idSchema(idType)},
${fields.map(line).join("\n")}
});

/** What creating a ${names.leaf} entry accepts. */
export const ${names.createSchema} = z.object({
${fields.map(line).join("\n")}
});

/** What updating a ${names.leaf} entry accepts: any subset of the create fields. */
export const ${names.updateSchema} = ${names.createSchema}.partial();

export type ${names.itemType} = z.infer<typeof ${names.itemSchema}>;
export type ${names.createType} = z.infer<typeof ${names.createSchema}>;
export type ${names.updateType} = z.infer<typeof ${names.updateSchema}>;
`;
};

export const resourceServiceTemplate = ({
  idType,
  names,
  schemaSpecifier,
}: {
  idType: ParamType;
  names: ResourceNames;
  schemaSpecifier: string;
}): string => {
  const deps = `${names.factory.replace(/^create/, "")}Deps`;
  const id = idType === "number" ? "number" : "string";
  const maybeItem = [names.itemType, "null"]
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .join(" | ");

  return `import type { EnvVariablesVitNode } from "@vitnode/core/api/middlewares/global.middleware";

import type {
  ${names.createType},
  ${names.itemType},
  ${names.updateType},
} from ${JSON.stringify(schemaSpecifier)};

/** What the ${names.label} service needs, passed in by whoever builds it. */
export interface ${deps} {
  /** In a route: \`c.get("db")\`. A transaction works too. */
  db: Omit<EnvVariablesVitNode["db"], "$client">;
}

/** Rejected by an operation that is not implemented yet. The routes answer it with 501. */
export class ${names.notImplementedError} extends Error {
  constructor(operation: string) {
    super(
      \`${names.label}: \${operation} is not implemented yet. Implement it in ${names.leaf}.service.ts.\`,
    );
    this.name = "${names.notImplementedError}";
  }
}

const notImplemented = async (operation: string): Promise<never> =>
  Promise.reject(new ${names.notImplementedError}(operation));

/**
 * Operations of the \`${names.label}\` resource. Build it where it is used:
 * \`${names.factory}({ db: c.get("db") })\`.
 *
 * Generated as typed stubs with no storage behind them: each one rejects with
 * {@link ${names.notImplementedError}} until you implement it - none returns
 * made-up data. Keep the signatures, replace the bodies with queries through
 * \`db\` (rename \`_deps\` to \`{ db }\`) and add further operations next to them.
 */
export const ${names.factory} = (_deps: ${deps}) => ({
  list: async (): Promise<${names.itemType}[]> => notImplemented("list"),
  /** Resolves \`null\` when there is no entry with this id. */
  get: async (_id: ${id}): Promise<${maybeItem}> => notImplemented("get"),
  create: async (_input: ${names.createType}): Promise<${names.itemType}> =>
    notImplemented("create"),
  /** Resolves \`null\` when there is no entry with this id. */
  update: async (_id: ${id}, _input: ${names.updateType}): Promise<${maybeItem}> =>
    notImplemented("update"),
  /** Resolves \`false\` when there is no entry with this id. */
  remove: async (_id: ${id}): Promise<boolean> => notImplemented("remove"),
});
`;
};

export type ResourceOperation =
  | "create"
  | "delete"
  | "list"
  | "show"
  | "update";

export const RESOURCE_OPERATIONS: readonly {
  method: "delete" | "get" | "patch" | "post";
  name: ResourceOperation;
  path: string;
  permission: "can_create" | "can_delete" | "can_edit" | "can_view";
}[] = [
  { method: "get", name: "list", path: "/", permission: "can_view" },
  { method: "get", name: "show", path: "/{id}", permission: "can_view" },
  { method: "post", name: "create", path: "/", permission: "can_create" },
  { method: "patch", name: "update", path: "/{id}", permission: "can_edit" },
  { method: "delete", name: "delete", path: "/{id}", permission: "can_delete" },
];

export const resourceRouteTemplate = ({
  builders,
  endpoint,
  factorySpecifier,
  identifier,
  idType,
  names,
  operation,
  permission,
  permissionSource,
  schemaSpecifier,
}: {
  builders: string;
  endpoint: string;
  factorySpecifier: string;
  identifier: string;
  idType: ParamType;
  names: ResourceNames;
  operation: ResourceOperation;
  permission?: { module: string; permission: string };
  permissionSource?: PermissionSource;
  schemaSpecifier: string;
}): string => {
  const hasId =
    operation === "show" || operation === "update" || operation === "delete";
  const schemaImports = {
    create: [names.createSchema, names.itemSchema],
    delete: [],
    list: [names.itemSchema],
    show: [names.itemSchema],
    update: [names.itemSchema, names.updateSchema],
  }[operation];
  const method =
    RESOURCE_OPERATIONS.find(item => item.name === operation)?.method ?? "get";
  const path = hasId ? "/{id}" : "/";
  const service = `${names.factory}({ db: c.get("db") })`;
  const params =
    idType === "number"
      ? "z.object({ id: z.coerce.number().int().positive() })"
      : "z.object({ id: z.string() })";
  const notFound = `      throw new HTTPException(404, { message: "No ${names.leaf} entry with this id." });`;

  const request = [
    hasId ? `      params: ${params},` : null,
    operation === "create" || operation === "update"
      ? `      body: {
        required: true,
        content: {
          "application/json": {
            schema: ${operation === "create" ? names.createSchema : names.updateSchema},
          },
        },
      },`
      : null,
  ].filter(line => line !== null);

  const success = {
    create: `      201: {
        content: { "application/json": { schema: ${names.itemSchema} } },
        description: "The created entry.",
      },`,
    delete: `      204: { description: "The entry was deleted." },`,
    list: `      200: {
        content: { "application/json": { schema: z.array(${names.itemSchema}) } },
        description: "Every entry.",
      },`,
    show: `      200: {
        content: { "application/json": { schema: ${names.itemSchema} } },
        description: "The entry.",
      },`,
    update: `      200: {
        content: { "application/json": { schema: ${names.itemSchema} } },
        description: "The updated entry.",
      },`,
  }[operation];

  const mapsNotImplemented = (
    prelude: string,
    body: string,
  ) => `  handler: async c => {
${prelude}    try {
${body}
    } catch (error) {
      if (error instanceof ${names.notImplementedError}) {
        return c.json(
          { error: "not_implemented" as const, message: error.message },
          501,
        );
      }
      throw error;
    }
  },`;
  const readId = `    const { id } = c.req.valid("param");\n`;
  const notFoundCheck = (value: string) => `      if (!${value}) {
  ${notFound}
      }
`;

  const handler = {
    create: mapsNotImplemented(
      "",
      `      const entry = await ${service}.create(c.req.valid("json"));

      return c.json(entry, 201);`,
    ),
    delete: mapsNotImplemented(
      readId,
      `      const deleted = await ${service}.remove(id);
${notFoundCheck("deleted")}
      return c.body(null, 204);`,
    ),
    list: mapsNotImplemented(
      "",
      `      return c.json(await ${service}.list(), 200);`,
    ),
    show: mapsNotImplemented(
      readId,
      `      const entry = await ${service}.get(id);
${notFoundCheck("entry")}
      return c.json(entry, 200);`,
    ),
    update: mapsNotImplemented(
      readId,
      `      const entry = await ${service}.update(id, c.req.valid("json"));
${notFoundCheck("entry")}
      return c.json(entry, 200);`,
    ),
  }[operation];

  const usesHttpException = hasId;
  const guard =
    permissionSource === undefined
      ? ""
      : `  adminStaffPermission: ${permissionSource.expression},\n`;
  const ownership =
    permission === undefined ||
    operation === "list" ||
    operation === "show" ||
    operation === "create"
      ? ""
      : `
 *
 * The staff permission decides who may call it. Whether this caller may change
 * this particular entry is for the service or handler to check.`;

  return `import { z } from "@hono/zod-openapi";
${usesHttpException ? 'import { HTTPException } from "hono/http-exception";\n' : ""}
${localImports(builders, permissionSource)}

${schemaImports.length > 0 ? `import { ${schemaImports.join(", ")} } from ${JSON.stringify(schemaSpecifier)};\n` : ""}import {
  ${[names.factory, names.notImplementedError].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })).join(",\n  ")},
} from ${JSON.stringify(factorySpecifier)};

/**
 * ${endpoint} - part of the generated \`${names.label}\` resource.
 *
 * Answers 501 until \`${names.factory}().${operation === "delete" ? "remove" : operation === "show" ? "get" : operation}\` is implemented;
 * then drop the \`catch\` and the 501 response.${ownership}
 */
export const ${identifier} = buildRoute({
${guard}  route: {
    method: ${JSON.stringify(method)},
    path: ${JSON.stringify(path)},
${request.length === 0 ? "" : `    request: {\n${request.join("\n")}\n    },\n`}    responses: {
${success}
${permission === undefined ? "" : `      403: { description: ${JSON.stringify(`Requires the ${permission.module}.${permission.permission} staff permission.`)} },\n`}${hasId ? '      404: { description: "No entry with this id." },\n' : ""}      501: {
        content: {
          "application/json": {
            schema: z.object({ error: z.literal("not_implemented"), message: z.string() }),
          },
        },
        description: "Not implemented yet.",
      },
    },
  },
${handler}
});
`;
};
