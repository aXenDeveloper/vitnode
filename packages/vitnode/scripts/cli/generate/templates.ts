export type HttpMethod = "delete" | "get" | "patch" | "post" | "put";

export const builtModuleTemplate = ({
  builders,
  identifier,
  name,
}: {
  builders: string;
  identifier: string;
  name: string;
}): string => `import { buildModule } from ${JSON.stringify(builders)};

export const ${identifier} = buildModule({
  name: ${JSON.stringify(name)},
  routes: [],
});
`;

export const buildersTemplate = (manifest: string): string =>
  `import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";

import { manifest } from ${JSON.stringify(manifest)};

const apiBuilders = bindApiPlugin(manifest);

export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
`;

export type ParamType = "number" | "string";

const paramSchema = (type: ParamType) =>
  type === "number" ? "z.coerce.number().int().positive()" : "z.string()";

const paramsObject = (params: readonly string[], type: ParamType) =>
  `z.object({ ${params.map(param => `${param}: ${paramSchema(type)}`).join(", ")} })`;

export interface PermissionSource {
  expression: string;
  importLine: string;
}

const permissionLine = (
  permission?: { module: string; permission: string },
  source?: PermissionSource,
) =>
  permission === undefined
    ? ""
    : source === undefined
      ? `  adminStaffPermission: { module: ${JSON.stringify(permission.module)}, permission: ${JSON.stringify(permission.permission)} },\n`
      : `  adminStaffPermission: ${source.expression},\n`;

export const localImports = (
  builders: string,
  source?: PermissionSource,
): string => {
  const buildersLine = `import { buildRoute } from ${JSON.stringify(builders)};`;
  if (source === undefined) return buildersLine;

  return source.importLine.includes('"@/') === buildersLine.includes('"@/')
    ? [buildersLine, source.importLine].sort().join("\n")
    : `${buildersLine}\n\n${source.importLine}`;
};

const forbiddenResponse = (permission?: {
  module: string;
  permission: string;
}) =>
  permission === undefined
    ? ""
    : `      403: { description: ${JSON.stringify(`Requires the ${permission.module}.${permission.permission} staff permission.`)} },\n`;

export interface RouteTemplateOptions {
  builders: string;
  endpoint: string;
  fileName: string;
  identifier: string;
  method: HttpMethod;
  params: readonly string[];
  paramType: ParamType;
  path: string;
  permission?: { module: string; permission: string };
  permissionSource?: PermissionSource;
}

const sampleGetTemplate = (options: RouteTemplateOptions): string => {
  const {
    builders,
    endpoint,
    fileName,
    identifier,
    params,
    paramType,
    path,
    permission,
  } = options;
  const message = `Sample data from ${fileName}. Replace it with the real response.`;
  const paramFields = params
    .map(
      param =>
        `${param}: ${paramType === "number" ? "z.number()" : "z.string()"}, `,
    )
    .join("");
  const handler =
    params.length === 0
      ? `  handler: c =>
    c.json(
      { sample: true as const, message: ${JSON.stringify(message)} },
      200,
    ),`
      : `  handler: c => {
    const { ${params.join(", ")} } = c.req.valid("param");

    return c.json(
      { sample: true as const, ${params.join(", ")}, message: ${JSON.stringify(message)} },
      200,
    );
  },`;

  return `import { z } from "@hono/zod-openapi";

${localImports(builders, options.permissionSource)}

/**
 * ${endpoint} - a generated starter that answers with sample data.
 *
 * Replace the 200 schema and the handler with the real response.
 */
export const ${identifier} = buildRoute({
${permissionLine(permission, options.permissionSource)}  route: {
    method: "get",
    path: ${JSON.stringify(path)},
${params.length === 0 ? "" : `    request: {\n      params: ${paramsObject(params, paramType)},\n    },\n`}    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ sample: z.literal(true), ${paramFields}message: z.string() }),
          },
        },
        description: "Sample data from a generated route.",
      },
${forbiddenResponse(permission)}    },
  },
${handler}
});
`;
};

const notImplementedTemplate = (options: RouteTemplateOptions): string => {
  const {
    builders,
    endpoint,
    fileName,
    identifier,
    method,
    params,
    paramType,
    path,
    permission,
  } = options;
  const hasBody = method === "post" || method === "put" || method === "patch";
  const request = [
    params.length === 0
      ? null
      : `      params: ${paramsObject(params, paramType)},`,
    hasBody
      ? `      body: {
        required: true,
        content: {
          // Describe the fields this endpoint accepts.
          "application/json": { schema: z.object({}) },
        },
      },`
      : null,
  ].filter(line => line !== null);
  const ownership =
    permission === undefined
      ? ""
      : `
 *
 * The staff permission decides who may call it at all. It does not check
 * access to a particular record - do that in the handler when it matters.`;

  return `${request.length > 0 ? 'import { z } from "@hono/zod-openapi";\n' : ""}import { HTTPException } from "hono/http-exception";

${localImports(builders, options.permissionSource)}

/**
 * ${endpoint} - a generated scaffold that answers 501 until implemented.
 *
 * Describe the input, add the success response to \`responses\`, then replace
 * the \`throw\` with the real operation.${ownership}
 */
export const ${identifier} = buildRoute({
${permissionLine(permission, options.permissionSource)}  route: {
    method: ${JSON.stringify(method)},
    path: ${JSON.stringify(path)},
${request.length === 0 ? "" : `    request: {\n${request.join("\n")}\n    },\n`}    responses: {
${forbiddenResponse(permission)}      501: { description: "Not implemented yet." },
    },
  },
  handler: () => {
    throw new HTTPException(501, {
      message: ${JSON.stringify(`${endpoint} is not implemented yet. Implement it in ${fileName}.`)},
    });
  },
});
`;
};

export const routeTemplate = (options: RouteTemplateOptions): string =>
  options.method === "get"
    ? sampleGetTemplate(options)
    : notImplementedTemplate(options);

export const serviceTemplate = ({
  factory,
  module,
}: {
  factory: string;
  module: string;
}): string => {
  const deps = `${factory.replace(/^create/, "")}Deps`;

  return `import type { EnvVariablesVitNode } from "@vitnode/core/api/middlewares/global.middleware";

/** What the ${module} service needs, passed in by whoever builds it. */
export interface ${deps} {
  /** In a route: \`c.get("db")\`. */
  db: Omit<EnvVariablesVitNode["db"], "$client">;
}

/**
 * Business operations for the \`${module}\` module.
 *
 * Generated empty - it has no operations yet. Add functions that take plain
 * input (and the acting user when one matters), not the Hono context, and
 * build the service where it is used: \`${factory}({ db: c.get("db") })\`.
 */
export const ${factory} = (deps: ${deps}) => ({ deps });
`;
};
