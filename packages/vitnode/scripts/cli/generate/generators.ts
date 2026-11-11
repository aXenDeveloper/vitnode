import type { ObjectExpression } from "oxc-parser";

import { posix } from "node:path";

import type { ModuleContainer, ModuleSource } from "./api-tree";
import type { Edit, ParsedSource } from "./ast";
import type { PermissionRef } from "./names";
import type { GenerationPlan } from "./plan";
import type { GeneratorProject } from "./project";
import type { HttpMethod, ParamType } from "./templates";

import { staffPermissionKey } from "../../../src/lib/staff-permissions";
import { ConfigError, UserError } from "../errors";
import {
  editableProperty,
  locate,
  lookupModule,
  readModuleContainer,
  readModuleSource,
  readParsed,
  readRootContainer,
  resolveBinding,
  specifierFor,
  UnsupportedStructureError,
  withManual,
} from "./api-tree";
import {
  addNamedImport,
  addProperty,
  appendToArray,
  applyEdits,
  arrayValue,
  findConstInit,
  isExported,
  listImports,
  objectArgument,
  objectValue,
  stringValue,
  topLevelNames,
  unwrap,
} from "./ast";
import { effectiveProperty } from "./effective-property";
import { assertNoEndpointCollisions, joinEndpointPath } from "./endpoints";
import {
  moduleIdentifier,
  permissionLabel,
  routeIdentifier,
  serviceFactoryIdentifier,
} from "./names";
import { API_BUILDERS, API_CONFIG, MODULES_DIR } from "./project";
import {
  buildersTemplate,
  builtModuleTemplate,
  routeTemplate,
  serviceTemplate,
} from "./templates";

export interface GenerateContext {
  notes: string[];
  plan: GenerationPlan;
  project: GeneratorProject;
  warnings: string[];
}

const MANIFEST = "src/manifest.gen.ts";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const propertyKey = (name: string): string =>
  IDENTIFIER.test(name) ? name : JSON.stringify(name);

export const ensureBuilders = (ctx: GenerateContext): void => {
  const { plan, project } = ctx;

  if (plan.exists(API_BUILDERS)) {
    const parsed = readParsed(plan, API_BUILDERS);
    const missing = ["buildModule", "buildRoute"].filter(
      name => !isExported(parsed.program, name),
    );
    if (missing.length > 0) {
      throw new ConfigError(
        `${API_BUILDERS} does not export ${missing.join(" and ")}.`,
        {
          details: [
            "Generated files import the plugin-bound builders from it. Add them:",
            "  const apiBuilders = bindApiPlugin(manifest);",
            "  export const buildModule = apiBuilders.buildModule;",
            "  export const buildRoute = apiBuilders.buildRoute;",
          ],
        },
      );
    }

    return;
  }

  const manifest = plan.read(MANIFEST);
  if (
    manifest === null ||
    !isExported(readParsed(plan, MANIFEST).program, "manifest")
  ) {
    throw new ConfigError(
      `${API_BUILDERS} is missing, and so is the plugin's manifest.`,
      {
        details: [
          `The builders bind to the plugin id through ${MANIFEST}, which vitnode build and vitnode dev write.`,
        ],
        hint: "Run vitnode build in the plugin once, then generate again.",
      },
    );
  }

  plan.create(
    API_BUILDERS,
    buildersTemplate(specifierFor(project, API_BUILDERS, MANIFEST, true)),
    "the plugin-bound buildModule and buildRoute",
  );
};

const buildersSpecifier = (project: GeneratorProject, file: string) =>
  specifierFor(project, file, API_BUILDERS, true);

export const assertFreeName = (parsed: ParsedSource, name: string) => {
  if (topLevelNames(parsed.program).has(name)) {
    throw new UserError(`${parsed.path} already declares ${name}.`, {
      details: [
        "The generator does not shadow or rename existing identifiers.",
      ],
    });
  }
};

const prefersAlias = (parsed: ParsedSource): boolean => {
  const moduleImports = listImports(parsed.program).filter(info =>
    /(?:^@\/|^\.\/)api\/modules\//.test(info.source),
  );
  if (moduleImports.length === 0) return true;

  return (
    moduleImports.filter(info => info.source.startsWith("@/")).length >=
    moduleImports.length / 2
  );
};

const registerModule = (
  ctx: GenerateContext,
  container: ModuleContainer,
  identifier: string,
  file: string,
  where: string,
) => {
  const { parsed } = container;
  assertFreeName(parsed, identifier);

  const isRoot = container.file === API_CONFIG;
  const specifier = specifierFor(
    ctx.project,
    container.file,
    file,
    isRoot && prefersAlias(parsed),
  );
  const edits: Edit[] = [...addNamedImport(parsed, specifier, identifier)];

  if (container.array === null) {
    edits.push(
      ...addProperty(
        parsed.source,
        container.options,
        `modules: [${identifier}]`,
        isRoot ? undefined : "routes",
      ),
    );
  } else {
    edits.push(...appendToArray(parsed.source, container.array, identifier));
  }

  ctx.plan.update(
    container.file,
    applyEdits(parsed.source, edits),
    `register ${identifier} in ${where}`,
  );
};

export interface ModuleOptions {
  parents: boolean;
}

export const planModule = (
  ctx: GenerateContext,
  path: readonly string[],
  { parents }: ModuleOptions,
): ModuleSource => {
  const { plan, project } = ctx;
  const lookup = lookupModule(plan, project, path);

  if (lookup.status === "found") {
    throw new UserError(`Module "${path.join("/")}" already exists.`, {
      details: [
        `Declared as ${lookup.module.exportName} in ${lookup.module.file}.`,
      ],
    });
  }

  if (lookup.depth < path.length - 1 && !parents) {
    const missing = path.slice(0, lookup.depth + 1).join("/");
    throw new UserError(`The parent module "${missing}" does not exist.`, {
      details: [
        `"${path.join("/")}" is registered inside its parent, so the parent has to exist first.`,
      ],
      hint: `Create it with vitnode g module ${missing}, or pass --parents to create every missing parent.`,
    });
  }

  let container = lookup.container;
  let dir =
    lookup.found.length === 0
      ? MODULES_DIR
      : (lookup.found[lookup.found.length - 1]?.dir ?? MODULES_DIR);
  let created: ModuleSource | null = null;

  for (let index = lookup.depth; index < path.length; index += 1) {
    const segment = path[index] ?? "";
    const modulePath = path.slice(0, index + 1);
    const identifier = moduleIdentifier(modulePath);
    const file = posix.join(dir, segment, `${segment}.module.ts`);

    plan.create(
      file,
      builtModuleTemplate({
        builders: buildersSpecifier(project, file),
        identifier,
        name: segment,
      }),
      `module "${modulePath.join("/")}"`,
    );

    registerModule(
      ctx,
      container,
      identifier,
      file,
      index === 0
        ? "buildApiPlugin"
        : `module "${path.slice(0, index).join("/")}"`,
    );

    const source = readModuleSource(plan, file, identifier);
    if (typeof source === "string") {
      throw new ConfigError(
        `The generated module could not be read back: ${source}.`,
      );
    }

    created = source;
    container = readModuleContainer(plan, project, created);
    dir = created.dir;
  }

  if (created === null) throw new ConfigError("No module was planned.");

  return created;
};

export interface RouteOptions {
  method: HttpMethod;
  name: string;
  paramType: ParamType;
  parents: boolean;
  path: string;
  permission?: PermissionRef;
}

export const pathParams = (path: string): string[] =>
  [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1] ?? "");

export const endpointPath = (modulePath: readonly string[], path: string) =>
  joinEndpointPath(modulePath, path);

export const routeFileFor = (module: ModuleSource, name: string): string =>
  posix.join(module.dir, "routes", `${name}.route.ts`);

export const planRoute = (
  ctx: GenerateContext,
  modulePath: readonly string[],
  options: RouteOptions,
): { file: string; identifier: string } => {
  const { plan, project } = ctx;
  const lookup = lookupModule(plan, project, modulePath);

  let module: ModuleSource;
  if (lookup.status === "found") {
    module = lookup.module;
  } else if (options.parents) {
    module = planModule(ctx, modulePath, { parents: true });
  } else {
    throw new UserError(`Module "${modulePath.join("/")}" does not exist.`, {
      hint: `Create it with vitnode g module ${modulePath.join("/")}, or pass --parents to create the missing modules.`,
    });
  }

  const routesProperty = editableProperty(
    module.parsed,
    module.options,
    "routes",
    `module "${modulePath.join("/")}"`,
  );
  const routes = arrayValue(routesProperty);
  if (routesProperty !== null && routes === null) {
    throw new UnsupportedStructureError(
      `The routes of module "${modulePath.join("/")}" are not an array literal.`,
      [`At ${locate(module.parsed, routesProperty.start)}.`],
    );
  }

  const endpoint = `${options.method.toUpperCase()} ${endpointPath(modulePath, options.path)}`;
  const identifier = routeIdentifier(options.name, modulePath);
  const file = routeFileFor(module, options.name);

  assertNoEndpointCollisions(ctx, [
    {
      file,
      identifier,
      method: options.method,
      modulePath,
      routePath: options.path,
    },
  ]);
  assertFreeName(module.parsed, identifier);

  plan.create(
    file,
    routeTemplate({
      builders: buildersSpecifier(project, file),
      endpoint,
      fileName: `${options.name}.route.ts`,
      identifier,
      method: options.method,
      params: pathParams(options.path),
      paramType: options.paramType,
      path: options.path,
      permission: options.permission,
      permissionSource:
        options.permission === undefined
          ? undefined
          : permissionSource(ctx, file, options.permission),
    }),
    endpoint,
  );

  const edits: Edit[] = [
    ...addNamedImport(
      module.parsed,
      specifierFor(project, module.file, file, false),
      identifier,
    ),
    ...(routes === null
      ? addProperty(
          module.parsed.source,
          module.options,
          `routes: [${identifier}]`,
          "name",
        )
      : appendToArray(module.parsed.source, routes, identifier)),
  ];
  plan.update(
    module.file,
    applyEdits(module.parsed.source, edits),
    `register ${identifier} in module "${modulePath.join("/")}"`,
  );

  return { file, identifier };
};

export type PermissionDeclarations =
  | { modules: Map<string, string[]>; status: "resolved" }
  | { reason: string; status: "unresolved" };

export type PermissionStaffLocation =
  | {
      exportName: string;
      file: string;
      kind: "defined";
      parsed: ParsedSource;
      staff: ObjectExpression;
    }
  | {
      file: string;
      holder: ObjectExpression;
      kind: "inline";
      parsed: ParsedSource;
      staff: null | ObjectExpression;
    }
  | { kind: "unresolved"; reason: string };

export const locatePermissionStaff = (
  ctx: GenerateContext,
): PermissionStaffLocation => {
  const root = readRootContainer(ctx.plan, ctx.project);
  const effective = effectiveProperty(root.options, "permissionStaff");

  if (effective.kind === "unsafe") {
    return {
      kind: "unresolved",
      reason: `in buildApiPlugin (${locate(root.parsed, effective.at)}), ${effective.reason}`,
    };
  }
  if (effective.kind === "absent") {
    return {
      file: API_CONFIG,
      holder: root.options,
      kind: "inline",
      parsed: root.parsed,
      staff: null,
    };
  }
  const property = effective.property;

  const value = unwrap(property.value);
  if (value.type === "ObjectExpression") {
    return {
      file: API_CONFIG,
      holder: root.options,
      kind: "inline",
      parsed: root.parsed,
      staff: value,
    };
  }

  if (
    value.type === "MemberExpression" &&
    !value.computed &&
    value.object.type === "Identifier" &&
    value.property.type === "Identifier" &&
    value.property.name === "config"
  ) {
    const binding = resolveBinding(
      ctx.plan,
      ctx.project,
      root.parsed,
      value.object.name,
    );
    if (typeof binding === "string") {
      return { kind: "unresolved", reason: `${value.object.name}: ${binding}` };
    }

    const parsed = readParsed(ctx.plan, binding.file);
    const init = findConstInit(parsed.program, binding.exportName);
    const call = init === null ? null : unwrap(init);
    const staff =
      call?.type === "CallExpression" &&
      call.callee.type === "Identifier" &&
      call.callee.name === "defineStaffPermissions"
        ? objectArgument(call)
        : null;

    return staff === null
      ? {
          kind: "unresolved",
          reason: `${binding.exportName} in ${binding.file} is not a defineStaffPermissions({...}) call`,
        }
      : {
          exportName: binding.exportName,
          file: binding.file,
          kind: "defined",
          parsed,
          staff,
        };
  }

  return {
    kind: "unresolved",
    reason: "permissionStaff is not an object literal",
  };
};

export const permissionSource = (
  ctx: GenerateContext,
  fromFile: string,
  ref: PermissionRef,
): undefined | { expression: string; importLine: string } => {
  const location = locatePermissionStaff(ctx);
  if (
    location.kind !== "defined" ||
    location.file === API_CONFIG ||
    !isExported(location.parsed.program, location.exportName)
  ) {
    return undefined;
  }
  const declarations = readAdminPermissions(ctx);
  if (
    declarations.status !== "resolved" ||
    declarations.modules.get(ref.module)?.includes(ref.permission) !== true
  ) {
    return undefined;
  }

  const member = (key: string) =>
    IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
  const key = staffPermissionKey(ref.permission);

  return {
    expression: `${location.exportName}.admin${member(ref.module)}${member(key)}`,
    importLine: `import { ${location.exportName} } from ${JSON.stringify(specifierFor(ctx.project, fromFile, location.file, true))};`,
  };
};

export const readAdminPermissions = (
  ctx: GenerateContext,
): PermissionDeclarations => {
  const location = locatePermissionStaff(ctx);
  if (location.kind === "unresolved") {
    return { reason: location.reason, status: "unresolved" };
  }

  const { staff } = location;
  if (staff === null) return { modules: new Map(), status: "resolved" };

  const admin = effectiveProperty(staff, "admin");
  if (admin.kind === "unsafe") {
    return {
      reason: `in permissionStaff (${locate(location.parsed, admin.at)}), ${admin.reason}`,
      status: "unresolved",
    };
  }
  if (admin.kind === "absent")
    return { modules: new Map(), status: "resolved" };

  const adminObject = objectValue(admin.property);
  if (
    adminObject === null ||
    adminObject.properties.some(property => property.type === "SpreadElement")
  ) {
    return {
      reason: "permissionStaff.admin is not a plain object literal",
      status: "unresolved",
    };
  }

  const modules = new Map<string, string[]>();
  for (const property of adminObject.properties) {
    if (
      property.type !== "Property" ||
      property.computed ||
      property.kind !== "init" ||
      property.method
    ) {
      return {
        reason: "permissionStaff.admin has a computed key, getter or method",
        status: "unresolved",
      };
    }
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal"
          ? String(property.key.value)
          : null;
    const entries = arrayValue(property);
    if (key === null || entries === null) {
      return {
        reason: `permissionStaff.admin.${key ?? "?"} is not an array literal`,
        status: "unresolved",
      };
    }

    const names: string[] = [];
    for (const element of entries.elements) {
      const value =
        element === null || element.type === "SpreadElement"
          ? null
          : unwrap(element);
      if (value?.type === "Literal" && typeof value.value === "string") {
        names.push(value.value);
      } else if (value?.type === "ObjectExpression") {
        const entry = effectiveProperty(value, "permission");
        const permission =
          entry.kind === "property" ? stringValue(entry.property) : null;
        if (permission === null) {
          return {
            reason: `an entry of permissionStaff.admin.${key} has no literal permission`,
            status: "unresolved",
          };
        }
        names.push(permission);
      } else {
        return {
          reason: `permissionStaff.admin.${key} has an entry that is not a literal`,
          status: "unresolved",
        };
      }
    }
    modules.set(key, names);
  }

  return { modules, status: "resolved" };
};

const LOCALE = "src/locales/en.json";

const planPermissionLabels = (ctx: GenerateContext, ref: PermissionRef) => {
  const source = ctx.plan.read(LOCALE);
  const keys = {
    [`${ctx.project.id}:${ref.module}`]: ref.module
      .replace(/[-_]+/g, " ")
      .replace(/^./, char => char.toUpperCase()),
    [`${ctx.project.id}:${ref.module}:${ref.permission}`]: permissionLabel(ref),
  };
  const manual = `Add the AdminCP labels to the root of ${LOCALE}: ${Object.entries(
    keys,
  )
    .map(([key, value]) => `"${key}": "${value}"`)
    .join(", ")}.`;

  if (source === null) {
    ctx.notes.push(manual);

    return;
  }

  let messages: Record<string, unknown>;
  try {
    messages = JSON.parse(source) as Record<string, unknown>;
  } catch {
    ctx.warnings.push(`${LOCALE} is not valid JSON. ${manual}`);

    return;
  }

  if (`${JSON.stringify(messages, null, 2)}\n` !== source) {
    ctx.notes.push(manual);

    return;
  }

  const missing = Object.entries(keys).filter(([key]) => !(key in messages));
  if (missing.length === 0) return;

  ctx.plan.update(
    LOCALE,
    `${JSON.stringify({ ...messages, ...Object.fromEntries(missing) }, null, 2)}\n`,
    `AdminCP labels for ${ref.module}.${ref.permission}`,
  );
};

export const planPermission = (
  ctx: GenerateContext,
  ref: PermissionRef,
  { declare, contentModules }: { contentModules: boolean; declare: boolean },
): void => {
  const declarations = readAdminPermissions(ctx);
  const wanted = `${ref.module}.${ref.permission}`;
  const entry = `${propertyKey(ref.module)}: [${JSON.stringify(ref.permission)}]`;
  const snippet = `permissionStaff: { admin: { ${entry} } }`;

  if (declarations.status === "unresolved") {
    if (declare) {
      throw new UnsupportedStructureError(
        `Cannot declare ${wanted}: ${declarations.reason}.`,
        [
          `Add ${JSON.stringify(ref.permission)} to permissionStaff.admin[${JSON.stringify(ref.module)}] in ${API_CONFIG} by hand.`,
        ],
      );
    }
    ctx.warnings.push(
      `Could not verify that ${wanted} is declared (${declarations.reason}). Check ${API_CONFIG}.`,
    );

    return;
  }

  if (declarations.modules.get(ref.module)?.includes(ref.permission) === true)
    return;

  if (!declare) {
    if (contentModules && !declarations.modules.has(ref.module)) {
      ctx.warnings.push(
        `${wanted} is not declared in ${API_CONFIG}. If a content type generates the "${ref.module}" permission module, this is fine; otherwise nobody can be granted it. Run vitnode plugin validate after building to check.`,
      );

      return;
    }

    const location = locatePermissionStaff(ctx);
    const defined = location.kind === "defined";
    throw new UserError(`The staff permission ${wanted} is not declared.`, {
      details: [
        `Nobody can be granted a permission the plugin does not declare in ${defined ? `${location.file} (defineStaffPermissions)` : API_CONFIG}:`,
        `  ${defined ? `admin: { ${entry} }` : snippet}`,
      ],
      hint: "Pass --declare-permission to add it (and its labels), or pick a declared one.",
    });
  }

  const location = locatePermissionStaff(ctx);
  if (location.kind === "unresolved") {
    throw new UnsupportedStructureError(
      `Cannot declare ${wanted}: ${location.reason}.`,
      [],
      [
        `Add ${JSON.stringify(ref.permission)} to permissionStaff.admin[${JSON.stringify(ref.module)}] by hand:`,
        `  ${snippet}`,
      ],
    );
  }

  const { parsed, staff } = location;
  const edits: Edit[] = [];
  const manual = [
    `Add ${JSON.stringify(ref.permission)} to permissionStaff.admin[${JSON.stringify(ref.module)}] in ${location.file}${location.kind === "defined" ? ` (the object passed to defineStaffPermissions for ${location.exportName})` : ""}:`,
    `  admin: { ${entry} }`,
  ];
  const editable = (object: ObjectExpression, name: string, where: string) =>
    withManual(manual, () => editableProperty(parsed, object, name, where));
  const adminProperty =
    staff === null ? null : editable(staff, "admin", "permissionStaff");
  const admin = objectValue(adminProperty);
  if (adminProperty !== null && admin === null) {
    throw new UnsupportedStructureError(
      `Cannot declare ${wanted}: permissionStaff.admin is not an object literal.`,
      [`At ${locate(parsed, adminProperty.start)}.`],
      manual,
    );
  }
  const moduleProperty =
    admin === null
      ? null
      : editable(admin, ref.module, "permissionStaff.admin");
  const moduleEntries = arrayValue(moduleProperty);
  if (moduleProperty !== null && moduleEntries === null) {
    throw new UnsupportedStructureError(
      `Cannot declare ${wanted}: permissionStaff.admin[${JSON.stringify(ref.module)}] is not an array literal.`,
      [`At ${locate(parsed, moduleProperty.start)}.`],
      manual,
    );
  }

  if (staff === null) {
    if (location.kind === "inline") {
      edits.push(...addProperty(parsed.source, location.holder, snippet));
    }
  } else if (admin === null) {
    edits.push(...addProperty(parsed.source, staff, `admin: { ${entry} }`));
  } else if (moduleEntries === null) {
    edits.push(...addProperty(parsed.source, admin, entry));
  } else {
    edits.push(
      ...appendToArray(
        parsed.source,
        moduleEntries,
        JSON.stringify(ref.permission),
      ),
    );
  }

  ctx.plan.update(
    location.file,
    applyEdits(parsed.source, edits),
    `declare the admin permission ${wanted}`,
  );
  planPermissionLabels(ctx, ref);
};

export const hasContentModules = (ctx: GenerateContext): boolean => {
  const lookup = lookupModule(ctx.plan, ctx.project, ["admin"]);
  if (lookup.status !== "found") return false;

  return readModuleContainer(ctx.plan, ctx.project, lookup.module).entries.some(
    entry => entry.kind === "fixed",
  );
};

export const planService = (
  ctx: GenerateContext,
  modulePath: readonly string[],
): { factory: string; file: string } => {
  const lookup = lookupModule(ctx.plan, ctx.project, modulePath);
  if (lookup.status !== "found") {
    throw new UserError(`Module "${modulePath.join("/")}" does not exist.`, {
      hint: `Create it first with vitnode g module ${modulePath.join("/")}.`,
    });
  }

  const leaf = modulePath[modulePath.length - 1] ?? "";
  const file = posix.join(lookup.module.dir, `${leaf}.service.ts`);
  const factory = serviceFactoryIdentifier(modulePath);

  ctx.plan.create(
    file,
    serviceTemplate({ factory, module: modulePath.join("/") }),
    `service for module "${modulePath.join("/")}"`,
  );

  return { factory, file };
};
