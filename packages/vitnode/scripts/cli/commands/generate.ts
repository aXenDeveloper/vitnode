import type { CommandContext, OutputOptions } from "../context";
import type { GenerateContext } from "../generate/generators";
import type { PermissionRef } from "../generate/names";
import type { FileChange } from "../generate/plan";
import type { GeneratorProject } from "../generate/project";
import type { HttpMethod, ParamType } from "../generate/templates";
import type { Ui } from "../ui/ui";

import { isAdminApiPath } from "../../../src/api/lib/route-metadata";
import { errorMessage, EXIT_CODE, RuntimeError, UserError } from "../errors";
import { lookupModule, UnsupportedStructureError } from "../generate/api-tree";
import { parseSource } from "../generate/ast";
import {
  parseContentFields,
  planContentResource,
} from "../generate/content-resource";
import { unifiedDiff } from "../generate/diff";
import { formatPlan } from "../generate/format";
import {
  endpointPath,
  ensureBuilders,
  hasContentModules,
  pathParams,
  permissionExpression,
  planModule,
  planPermission,
  planRoute,
  planService,
  readAdminPermissions,
  STAFF_PERMISSIONS,
} from "../generate/generators";
import {
  moduleIdentifier,
  parseLogicalPath,
  parsePermission,
  routeIdentifier,
} from "../generate/names";
import { applyPlan, GenerationPlan } from "../generate/plan";
import { resolveGeneratorProject } from "../generate/project";
import { planApiResource } from "../generate/resource";
import { parseFields } from "../generate/resource-templates";
import { plural } from "../ui/format";

export interface GenerateCommonOptions extends OutputOptions {
  dryRun?: boolean;
  project?: string;
}

export interface GenerateModuleOptions extends GenerateCommonOptions {
  admin?: boolean;
  name?: string;
  parents?: boolean;
}

export interface GenerateRouteOptions extends GenerateCommonOptions {
  admin?: boolean;
  declarePermission?: boolean;
  idType?: string;
  method?: string;
  parents?: boolean;
  path?: string;
  permission?: string;
  target?: string;
}

export interface GenerateResourceOptions extends GenerateCommonOptions {
  admin?: boolean;
  contentId?: string;
  declarePermission?: boolean;
  fields?: string;
  idType?: string;
  kind?: string;
  name?: string;
  parents?: boolean;
  permissionModule?: string;
  singular?: string;
  table?: string;
}

export interface GenerateServiceOptions extends GenerateCommonOptions {
  admin?: boolean;
  name?: string;
}

const METHODS: readonly HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
];

export const ROUTE_DEFAULTS: Record<
  string,
  { method: HttpMethod; path: string }
> = {
  create: { method: "post", path: "/" },
  delete: { method: "delete", path: "/{id}" },
  list: { method: "get", path: "/" },
  show: { method: "get", path: "/{id}" },
  update: { method: "patch", path: "/{id}" },
};

const RESERVED_PARAMS = new Set([
  "await",
  "break",
  "c",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const PATH_SEGMENT = /^(?:[A-Za-z0-9._~-]+|\{[A-Za-z_][A-Za-z0-9_]*\})$/;

export const assertRoutePath = (path: string): string => {
  const problem = (reason: string) =>
    new UserError(`"${path}" is not a supported route path: ${reason}.`, {
      details: [
        "Use OpenAPI parameter syntax relative to the module: /, /{id}, /{id}/archive.",
        "Each segment is plain text or one {param}; :id, *, {id?} and a{b} are not supported.",
      ],
    });

  if (!path.startsWith("/")) throw problem("it must start with /");
  if (path === "/") return path;
  if (path.endsWith("/")) throw problem("it must not end with /");

  for (const segment of path.slice(1).split("/")) {
    if (!PATH_SEGMENT.test(segment))
      throw problem(`"${segment}" is not a plain segment or a {param}`);
  }

  const params = pathParams(path);
  if (new Set(params).size !== params.length)
    throw problem("a parameter appears twice");
  if (params.some(param => param === "sample" || param === "message")) {
    throw problem(
      "sample and message are reserved by the generated starter response",
    );
  }
  const reserved = params.find(param => RESERVED_PARAMS.has(param));
  if (reserved !== undefined) {
    throw problem(
      `{${reserved}} cannot be a variable name in the generated handler; rename the parameter`,
    );
  }

  return path;
};

const withAdmin = (path: string[], admin: boolean | undefined): string[] => {
  if (!admin) return path;
  if (path[0] === "admin") {
    throw new UserError(
      `"${path.join("/")}" is already in the admin module tree.`,
      {
        hint: "Drop --admin, or drop the admin/ prefix.",
      },
    );
  }

  return ["admin", ...path];
};

const resolveParents = async (
  context: CommandContext,
  ctx: GenerateContext,
  modulePath: readonly string[],
  requiredDepth: number,
  parents: boolean,
): Promise<boolean> => {
  if (parents || !context.ui.interactive) return parents;

  const lookup = lookupModule(ctx.plan, ctx.project, modulePath);
  if (lookup.status === "found" || lookup.depth >= requiredDepth) return false;

  const missing = modulePath
    .slice(lookup.depth, requiredDepth)
    .map((_, index) => modulePath.slice(0, lookup.depth + index + 1).join("/"));

  return context.prompter.confirm(
    `Create the missing ${plural(missing.length, "module")} ${missing.join(", ")}?`,
    { default: true },
  );
};

const renderDiff = (ui: Ui, change: FileChange) => {
  for (const line of unifiedDiff(change.path, change.before, change.after)) {
    if (ui.mode === "plain") ui.line(line);
    else if (line.startsWith("+++") || line.startsWith("---"))
      ui.line(ui.colors.bold(line));
    else if (line.startsWith("@@")) ui.line(ui.colors.command(line));
    else if (line.startsWith("+")) ui.line(ui.colors.success(line));
    else if (line.startsWith("-")) ui.line(ui.colors.error(line));
    else ui.line(line);
  }
};

const renderChanges = (
  ui: Ui,
  changes: readonly FileChange[],
  dryRun: boolean,
) => {
  for (const change of changes) {
    const verb =
      change.kind === "create"
        ? dryRun
          ? "would create"
          : "created"
        : dryRun
          ? "would update"
          : "updated";
    const text = `${verb.padEnd(12)} ${change.path}`;
    const detail = change.reasons.join("; ");

    if (dryRun) ui.info(`${text}  ${ui.colors.muted(detail)}`);
    else ui.success(text, detail);
  }
};

const finish = async (
  context: CommandContext,
  ctx: GenerateContext,
  { dryRun }: GenerateCommonOptions,
  next: (ui: Ui) => void,
): Promise<number> => {
  const { ui } = context;
  const formatting = await formatPlan(ctx.plan, ctx.plan.changes());
  const changes = ctx.plan.changes();

  for (const change of changes) {
    if (!/\.(?:ts|tsx|mts|cts)$/.test(change.path)) continue;
    try {
      parseSource(change.path, change.after);
    } catch (error) {
      throw new RuntimeError(
        `The generator produced invalid code for ${change.path}. Nothing was written.`,
        {
          cause: error,
          details: [errorMessage(error)],
          hint: "Please report this with the file's original contents. Run with --dry-run to see the planned diff.",
        },
      );
    }
  }

  if (formatting.skipped !== undefined) {
    ctx.notes.push(`Generated code was not formatted: ${formatting.skipped}.`);
  }

  ui.keyValue([
    ["Plugin", `${ctx.project.id}  ${ui.colors.muted(ctx.project.display)}`],
  ]);
  ui.line();

  if (dryRun) {
    for (const change of changes) {
      renderDiff(ui, change);
      ui.line();
    }
    renderChanges(ui, changes, true);
  } else {
    applyPlan(ctx.plan.root, changes);
    renderChanges(ui, changes, false);
  }

  ui.line();
  ctx.warnings.forEach(warning => {
    ui.warning(warning);
  });
  ctx.notes.forEach(note => {
    ui.note(note);
  });
  if (ctx.warnings.length + ctx.notes.length > 0) ui.line();

  if (dryRun) {
    ui.note(
      `Dry run: ${plural(changes.filter(change => change.kind === "create").length, "file")} to create, ${String(changes.filter(change => change.kind === "update").length)} to update. Nothing was written.`,
    );
    ui.line();

    return EXIT_CODE.ok;
  }

  next(ui);
  ui.line();

  return EXIT_CODE.ok;
};

const start = async (
  context: CommandContext,
  title: string,
  options: GenerateCommonOptions,
): Promise<GenerateContext> => {
  context.ui.header(options.dryRun ? `${title} (dry run)` : title);

  const project: GeneratorProject = await resolveGeneratorProject({
    cwd: context.cwd,
    project: options.project,
    prompter: context.prompter,
    ui: context.ui,
  });
  const ctx: GenerateContext = {
    notes: [],
    plan: new GenerationPlan(project.root),
    project,
    warnings: [],
  };
  ensureBuilders(ctx);

  return ctx;
};

const withManualSteps = async <T>(
  action: () => Promise<T> | T,
  manual: string[],
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (
      error instanceof UnsupportedStructureError &&
      error.manual.length === 0
    ) {
      throw error.withManual(manual);
    }
    throw error;
  }
};

const mountPath = (project: GeneratorProject, path: string) =>
  `/${project.id}${path}`;

const typesNote = (ui: Ui) => {
  ui.note(
    "Types: the plugin's own code sees the change at once. An app sees it once the plugin's declarations are rebuilt - vitnode dev does that on save, otherwise run vitnode build in the plugin.",
  );
};

export const runGenerateModuleCommand = async (
  context: CommandContext,
  options: GenerateModuleOptions,
): Promise<number> => {
  if (options.name === undefined)
    throw new UserError("Name the module, e.g. vitnode g module notes.");
  const path = withAdmin(
    parseLogicalPath(options.name, "module name"),
    options.admin,
  );
  const ctx = await start(context, "Generate a module", options);
  const leaf = path[path.length - 1] ?? "";
  const identifier = moduleIdentifier(path);
  await withManualSteps(async () => {
    const parents = await resolveParents(
      context,
      ctx,
      path,
      path.length - 1,
      options.parents ?? false,
    );
    planModule(ctx, path, { parents });
  }, [
    `Create ${leaf}/${leaf}.module.ts next to the parent module (src/api/modules/ for a top-level one):`,
    `  export const ${identifier} = buildModule({ name: ${JSON.stringify(leaf)}, routes: [] });`,
    path.length === 1
      ? `Import ${identifier} in src/config.api.ts and add it to buildApiPlugin({ modules }).`
      : `Import ${identifier} in the "${path.slice(0, -1).join("/")}" module and add it to its modules.`,
  ]);

  return finish(context, ctx, options, ui => {
    ui.note(
      `Module ${path.join("/")} is mounted at ${mountPath(ctx.project, `/${path.join("/")}`)} under the app's API base path (/api in the starter apps).`,
    );
    ui.note("It has no routes yet, so there is nothing to call. Add one with:");
    ui.line(`  ${ui.colors.command(`vitnode g route ${path.join("/")}/list`)}`);
  });
};

const pickMethod = async (
  context: CommandContext,
  name: string,
  method: string | undefined,
): Promise<HttpMethod> => {
  if (method !== undefined) {
    const lower = method.toLowerCase();
    const known = METHODS.find(item => item === lower);
    if (known === undefined) {
      throw new UserError(`"${method}" is not a supported HTTP method.`, {
        hint: `Use one of: ${METHODS.join(", ")}.`,
      });
    }

    return known;
  }

  const fallback = ROUTE_DEFAULTS[name]?.method;
  if (fallback !== undefined) return fallback;

  if (!context.ui.interactive) {
    throw new UserError(`The route "${name}" needs --method.`, {
      details: [
        `Only ${Object.keys(ROUTE_DEFAULTS).join(", ")} imply a method.`,
      ],
    });
  }

  return context.prompter.select(
    "HTTP method",
    METHODS.map(item => ({ name: item.toUpperCase(), value: item })),
  );
};

const pickPath = async (
  context: CommandContext,
  name: string,
  path: string | undefined,
): Promise<string> => {
  if (path !== undefined) return assertRoutePath(path);

  const fallback = ROUTE_DEFAULTS[name]?.path;
  if (fallback !== undefined) return fallback;

  if (!context.ui.interactive) {
    throw new UserError(`The route "${name}" needs --path.`, {
      details: [
        `Only ${Object.keys(ROUTE_DEFAULTS).join(", ")} imply a path; a file name is not a URL.`,
        "Pass it relative to the module, e.g. --path / or --path '/{id}/archive'.",
      ],
    });
  }

  return assertRoutePath(
    await context.prompter.text(
      "Path, relative to the module (e.g. / or /{id})",
      {
        validate: value => {
          try {
            assertRoutePath(value);

            return true;
          } catch (error) {
            return errorMessage(error);
          }
        },
      },
    ),
  );
};

const pickPermission = async (
  context: CommandContext,
  ctx: GenerateContext,
  permission: string | undefined,
): Promise<PermissionRef> => {
  if (permission !== undefined) return parsePermission(permission);

  const declarations = readAdminPermissions(ctx);
  const declared =
    declarations.status === "resolved"
      ? [...declarations.modules].flatMap(([module, names]) =>
          names.map(name => `${module}.${name}`),
        )
      : [];

  if (!context.ui.interactive || declared.length === 0) {
    throw new UserError(
      "Admin routes need a staff permission: pass --permission <module.permission>.",
      {
        details: [
          "Every route under admin/ is checked against one, e.g. --permission notes.can_create.",
          declared.length === 0
            ? "This plugin declares none yet - add --declare-permission to declare it as well."
            : `Declared: ${declared.join(", ")}`,
        ],
      },
    );
  }

  return parsePermission(
    await context.prompter.select(
      "Staff permission required to call it",
      declared.map(value => ({ name: value, value })),
    ),
  );
};

const fetcherExample = (
  project: GeneratorProject,
  modulePath: readonly string[],
  method: HttpMethod,
  path: string,
  paramType: ParamType,
): string[] => {
  const params = pathParams(path);
  const sample = paramType === "number" ? "1" : '"1"';
  const args = [
    params.length === 0
      ? null
      : `params: { ${params.map(param => `${param}: ${sample}`).join(", ")} }`,
    method === "post" || method === "put" || method === "patch"
      ? "body: {}"
      : null,
  ].filter(part => part !== null);

  return [
    'import { fetcher } from "@vitnode/core/tanstack/fetcher";',
    "",
    "const response = await fetcher({",
    `  plugin: ${JSON.stringify(project.id)},`,
    `  method: ${JSON.stringify(method)},`,
    `  module: ${JSON.stringify(modulePath.join("/"))},`,
    `  path: ${JSON.stringify(path)},`,
    ...(args.length === 0 ? [] : [`  args: { ${args.join(", ")} },`]),
    "});",
  ];
};

export const runGenerateRouteCommand = async (
  context: CommandContext,
  options: GenerateRouteOptions,
): Promise<number> => {
  if (options.target === undefined) {
    throw new UserError(
      "Name the route as <module>/<route>, e.g. vitnode g route notes/list.",
    );
  }

  const segments = parseLogicalPath(options.target, "route");
  if (segments.length < 2) {
    throw new UserError(`"${options.target}" names no module.`, {
      details: [
        "Write the route as <module path>/<route name>, e.g. notes/list or admin/notes/create.",
      ],
    });
  }

  const name = segments[segments.length - 1] ?? "";
  const modulePath = withAdmin(segments.slice(0, -1), options.admin);
  const idType = options.idType ?? "string";
  if (idType !== "string" && idType !== "number") {
    throw new UserError(`--id-type must be string or number, not "${idType}".`);
  }

  const ctx = await start(context, "Generate a route", options);
  const method = await pickMethod(context, name, options.method);
  const path = await pickPath(context, name, options.path);
  const isAdmin = isAdminApiPath(`${modulePath.join("/")}${path}`);

  if (
    !isAdmin &&
    (options.permission !== undefined || options.declarePermission)
  ) {
    throw new UserError("--permission only applies to admin routes.", {
      details: [
        "An admin staff permission guards routes in the admin module tree, which also requires an AdminCP session.",
        "Generate the route under admin/ (or with --admin) instead of guarding a public module.",
      ],
    });
  }

  const permission = isAdmin
    ? await pickPermission(context, ctx, options.permission)
    : undefined;
  const parents = await resolveParents(
    context,
    ctx,
    modulePath,
    modulePath.length,
    options.parents ?? false,
  );

  if (permission !== undefined) {
    await withManualSteps(() => {
      planPermission(ctx, permission, {
        contentModules: hasContentModules(ctx),
        declare: options.declarePermission ?? false,
      });
    }, [
      `Declare ${JSON.stringify(permission.permission)} in admin[${JSON.stringify(permission.module)}] of the plugin's defineStaffPermissions(manifest, {...}) (${STAFF_PERMISSIONS}),`,
      `then create routes/${name}.route.ts in the folder of the "${modulePath.join("/")}" module file with adminStaffPermission: ${permissionExpression("staffPermissions", permission)},`,
      `import it in the module file from "./routes/${name}.route" and add it to the end of buildModule({ routes }).`,
    ]);
  }

  const { file } = await withManualSteps(
    () =>
      planRoute(ctx, modulePath, {
        method,
        name,
        paramType: idType,
        parents,
        path,
        permission,
      }),
    [
      `Create routes/${name}.route.ts in the folder of the "${modulePath.join("/")}" module file, exporting`,
      `  ${routeIdentifier(name, modulePath)} = buildRoute({ route: { method: ${JSON.stringify(method)}, path: ${JSON.stringify(path)}, ... }, handler })`,
      `Import it in the module file from "./routes/${name}.route" and add it to the end of buildModule({ routes }).`,
    ],
  );

  return finish(context, ctx, options, ui => {
    const endpoint = endpointPath(modulePath, path);
    ui.note(
      `${method.toUpperCase()} ${mountPath(ctx.project, endpoint)} under the app's API base path (/api in the starter apps).`,
    );
    ui.note(
      method === "get"
        ? `It answers with sample data. Replace the schema and handler in ${file}.`
        : `It validates the request and answers 501 Not Implemented until you implement it in ${file}.`,
    );
    if (permission !== undefined) {
      ui.note(
        `Guarded by the ${permission.module}.${permission.permission} staff permission. That decides who may call it, not which records they may touch.`,
      );
    }
    ui.line();
    ui.note("Call it from a page:");
    fetcherExample(ctx.project, modulePath, method, path, idType).forEach(
      line => {
        ui.line(line === "" ? "" : `  ${ui.colors.command(line)}`);
      },
    );
    ui.line();
    typesNote(ui);
  });
};

export const runGenerateServiceCommand = async (
  context: CommandContext,
  options: GenerateServiceOptions,
): Promise<number> => {
  if (options.name === undefined)
    throw new UserError("Name the module, e.g. vitnode g service notes.");
  const path = withAdmin(
    parseLogicalPath(options.name, "module name"),
    options.admin,
  );
  const ctx = await start(context, "Generate a service", options);
  const { factory, file } = planService(ctx, path);

  return finish(context, ctx, options, ui => {
    ui.note(
      `${factory} has no operations yet. Add them in ${file}, then build it in a route:`,
    );
    ui.line(
      `  ${ui.colors.command(`const service = ${factory}({ db: c.get("db") });`)}`,
    );
    ui.note("Existing routes were not changed.");
  });
};

export const runGenerateResourceCommand = async (
  context: CommandContext,
  options: GenerateResourceOptions,
): Promise<number> => {
  if (options.name === undefined) {
    throw new UserError(
      "Name the resource, e.g. vitnode g resource notes --kind api.",
    );
  }
  if (options.kind === "content") return runContentResource(context, options);
  if (options.kind !== "api") {
    throw new UserError(
      options.kind === undefined
        ? "Pass --kind api or --kind content."
        : `--kind ${options.kind} is not supported.`,
      {
        details: [
          "--kind api scaffolds a module, schemas, a service and CRUD routes.",
          "--kind content defines a Content Engine content type with generated staff routes and AdminCP screens.",
        ],
      },
    );
  }

  const path = withAdmin(
    parseLogicalPath(options.name, "resource name"),
    options.admin,
  );
  const isAdmin = isAdminApiPath(path.join("/"));
  const idType = options.idType ?? "string";
  if (idType !== "string" && idType !== "number") {
    throw new UserError(`--id-type must be string or number, not "${idType}".`);
  }
  if (
    !isAdmin &&
    (options.permissionModule !== undefined || options.declarePermission)
  ) {
    throw new UserError(
      "--permission-module only applies to admin resources.",
      {
        details: ["Generate the resource under admin/ (or with --admin)."],
      },
    );
  }

  const ctx = await start(context, "Generate an API resource", options);

  let fieldsInput = options.fields;
  if (fieldsInput === undefined && context.ui.interactive) {
    fieldsInput = await context.prompter.text(
      "Fields as name:type, comma-separated (string, number, int, boolean; name?: for optional). Empty for an id-only scaffold",
      {
        default: "",
        validate: value => {
          try {
            parseFields(value);

            return true;
          } catch (error) {
            return errorMessage(error);
          }
        },
      },
    );
  }
  const fields = parseFields(fieldsInput ?? "");

  let permissionModule = options.permissionModule;
  if (isAdmin && permissionModule === undefined && context.ui.interactive) {
    permissionModule = await context.prompter.text(
      "Staff permission module (gets can_view, can_create, can_edit, can_delete)",
      { default: path[path.length - 1] },
    );
  }
  if (permissionModule !== undefined)
    parsePermission(`${permissionModule}.can_view`);

  const parents = await resolveParents(
    context,
    ctx,
    path,
    path.length - 1,
    options.parents ?? false,
  );
  const { files, names } = await withManualSteps(
    () =>
      planApiResource(ctx, path, {
        fields,
        idType,
        parents,
        permissions:
          permissionModule === undefined
            ? undefined
            : {
                declare: options.declarePermission ?? false,
                module: permissionModule,
              },
      }),
    [
      `Give the "${path.join("/")}" module a plain routes: [...] array literal with no spread or computed key after it, and run the command again;`,
      `or write its routes/list|show|create|update|delete.route.ts files by hand, import them in the module file from "./routes/<operation>.route" and add them to buildModule({ routes }).`,
    ],
  );

  if (fields.length === 0) {
    ctx.notes.push(
      `No --fields given: ${files.schema} models only the id. Add your fields there.`,
    );
  }

  return finish(context, ctx, options, ui => {
    ui.note(
      `The ${names.label} resource is mounted at ${mountPath(ctx.project, `/${path.join("/")}`)} under the app's API base path (/api in the starter apps).`,
    );
    ui.note(
      `Every route answers 501 Not Implemented until you implement ${names.factory} in ${files.service}. No table or migration was created.`,
    );
    if (permissionModule !== undefined) {
      ui.note(
        `Guards: list and show need ${permissionModule}.can_view, create ${permissionModule}.can_create, update ${permissionModule}.can_edit, delete ${permissionModule}.can_delete.`,
      );
    }
    ui.line();
    typesNote(ui);
  });
};

const runContentResource = async (
  context: CommandContext,
  options: GenerateResourceOptions,
): Promise<number> => {
  const segments = parseLogicalPath(options.name ?? "", "resource name");
  const name = segments[0] ?? "";
  if (
    segments.length !== 1 ||
    options.admin ||
    options.permissionModule !== undefined
  ) {
    throw new UserError(
      "A content resource is named by one segment, e.g. articles.",
      {
        details: [
          "The Content Engine mounts its staff routes under admin/content/ and adds can_view, can_create, can_edit and can_delete itself,",
          "so --admin, --permission-module and nested names do not apply.",
        ],
      },
    );
  }

  const idStrategy = options.idType ?? "serial";
  if (
    idStrategy !== "serial" &&
    idStrategy !== "uuid" &&
    idStrategy !== "bigint"
  ) {
    throw new UserError(
      `--id-type for a content resource is serial, uuid or bigint, not "${idStrategy}".`,
    );
  }

  const ctx = await start(context, "Generate a content resource", options);

  let fieldsInput = options.fields;
  if (fieldsInput === undefined && context.ui.interactive) {
    fieldsInput = await context.prompter.text(
      "Fields as name:type, comma-separated (text, richText, boolean, int, number; name?: for optional)",
      {
        validate: value => {
          try {
            parseContentFields(value);

            return true;
          } catch (error) {
            return errorMessage(error);
          }
        },
      },
    );
  }
  if (fieldsInput === undefined) {
    throw new UserError("A content resource needs --fields.", {
      details: [
        'For example: --fields "title:text,body:richText". The first required text field is the title.',
      ],
    });
  }

  const fields = parseContentFields(fieldsInput);
  const result = await withManualSteps(
    () =>
      planContentResource(ctx, name, {
        fields,
        id: options.contentId,
        idStrategy,
        singular: options.singular,
        tableName: options.table,
      }),
    [
      "Mount the content type in the plugin's admin module by hand: buildContentAdminModule({ contentTypes: [<model>] }) in its modules,",
      "with the definition in src/content/ and the model from createContentModel in src/database/ (see the Content Engine docs).",
    ],
  );

  return finish(context, ctx, options, ui => {
    ui.note(
      `${result.contentTypeId} is administrative only: staff manage it at /admin/content/${result.adminPath}. It has no public API, member writes or publication workflow.`,
    );
    ui.note(
      `The Content Engine serves its staff routes at ${mountPath(ctx.project, "/admin/content/...")} and guards them with ${result.permissionModule}.can_view, can_create, can_edit and can_delete.`,
    );
    ui.line();
    ui.note("Then, in this order - nothing was migrated:");
    ui.line(
      `  1. ${ui.colors.command("vitnode build")} in the plugin (or keep ${ui.colors.command("vitnode dev")} running), so migrations can read the table ${result.tableName}.`,
    );
    ui.line(
      `  2. ${ui.colors.command("vitnode db generate")} in the app that owns the database, and review the migration.`,
    );
    ui.line(
      `  3. ${ui.colors.command("vitnode db migrate")} there to apply it.`,
    );
  });
};
