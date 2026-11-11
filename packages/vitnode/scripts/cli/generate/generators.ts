import type { ObjectExpression } from "oxc-parser";

import { posix } from "node:path";

import type { ModuleContainer, ModuleSource } from "./api-tree";
import type { Edit, ParsedSource } from "./ast";
import type { PermissionRef } from "./names";
import type { GenerationPlan } from "./plan";
import type { GeneratorProject } from "./project";
import type { HttpMethod, ParamType, PermissionSource } from "./templates";

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
  staffPermissionsTemplate,
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
    "the plugin-bound API builders",
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

/** Where a plugin's generated staff permission module lives by default. */
export const STAFF_PERMISSIONS = "src/staff-permissions.ts";
const STAFF_PERMISSIONS_EXPORT = "staffPermissions";

export type PermissionStaffLocation =
  | {
      /** `buildApiPlugin`'s options, which have no `permissionStaff` yet. */
      holder: ObjectExpression;
      kind: "absent";
      parsed: ParsedSource;
    }
  | {
      exportName: string;
      file: string;
      kind: "defined";
      parsed: ParsedSource;
      /** The declarations object passed to `defineStaffPermissions(manifest, {...})`. */
      staff: ObjectExpression;
    }
  | { kind: "unresolved"; reason: string };

const MOVE_TO_MODULE = `declare the permissions with defineStaffPermissions(manifest, { admin, moderator }) in ${STAFF_PERMISSIONS}, export it, and pass that object as permissionStaff`;

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
    return { holder: root.options, kind: "absent", parsed: root.parsed };
  }

  const value = unwrap(effective.property.value);
  if (value.type !== "Identifier") {
    return {
      kind: "unresolved",
      reason: `permissionStaff in ${API_CONFIG} is not a defineStaffPermissions(...) reference - ${MOVE_TO_MODULE}`,
    };
  }

  const binding = resolveBinding(
    ctx.plan,
    ctx.project,
    root.parsed,
    value.name,
  );
  if (typeof binding === "string") {
    return { kind: "unresolved", reason: `${value.name}: ${binding}` };
  }
  if (binding.file === API_CONFIG) {
    return {
      kind: "unresolved",
      reason: `${value.name} is declared in ${API_CONFIG}, which routes and the AdminCP navigation must not import - move it to its own module (${STAFF_PERMISSIONS})`,
    };
  }

  const parsed = readParsed(ctx.plan, binding.file);
  const init = findConstInit(parsed.program, binding.exportName);
  const call = init === null ? null : unwrap(init);
  const [, declarations] =
    call?.type === "CallExpression" &&
    call.callee.type === "Identifier" &&
    call.callee.name === "defineStaffPermissions"
      ? call.arguments
      : [];
  const staff =
    declarations === undefined || declarations.type === "SpreadElement"
      ? null
      : unwrap(declarations);

  if (staff?.type !== "ObjectExpression") {
    return {
      kind: "unresolved",
      reason: `${binding.exportName} in ${binding.file} is not a defineStaffPermissions(manifest, {...}) call`,
    };
  }
  if (!isExported(parsed.program, binding.exportName)) {
    return {
      kind: "unresolved",
      reason: `${binding.exportName} in ${binding.file} is not exported, so generated routes cannot import it`,
    };
  }

  return {
    exportName: binding.exportName,
    file: binding.file,
    kind: "defined",
    parsed,
    staff,
  };
};

const member = (key: string) =>
  IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;

/** `staffPermissions.admin.notes.canCreate`, for code and messages. */
export const permissionExpression = (
  exportName: string,
  ref: PermissionRef,
): string =>
  `${exportName}.admin${member(ref.module)}${member(staffPermissionKey(ref.permission))}`;

/**
 * The typed reference a generated route guards with, and its import. The
 * permission must be declared in the plugin's `defineStaffPermissions` module
 * (`planPermission` checks that, or declares it, first).
 *
 * @throws {UnsupportedStructureError} When the plugin's permissions cannot be
 * located, or `ref` is not declared there.
 */
export const permissionSource = (
  ctx: GenerateContext,
  fromFile: string,
  ref: PermissionRef,
): PermissionSource => {
  const location = locatePermissionStaff(ctx);
  const wanted = `${ref.module}.${ref.permission}`;
  const manual = [
    `Declare ${JSON.stringify(ref.permission)} in the admin.${ref.module} of the plugin's defineStaffPermissions(manifest, {...}) (${STAFF_PERMISSIONS}),`,
    `and guard the route with adminStaffPermission: ${permissionExpression(STAFF_PERMISSIONS_EXPORT, ref)}.`,
  ];

  if (location.kind !== "defined") {
    throw new UnsupportedStructureError(
      `Cannot reference the staff permission ${wanted}.`,
      [
        location.kind === "absent"
          ? `${API_CONFIG} passes no permissionStaff to buildApiPlugin.`
          : `${location.reason}.`,
      ],
      manual,
    );
  }

  const declarations = readAdminPermissions(ctx);
  if (
    declarations.status !== "resolved" ||
    declarations.modules.get(ref.module)?.includes(ref.permission) !== true
  ) {
    throw new UnsupportedStructureError(
      `Cannot reference the staff permission ${wanted}: ${location.file} does not declare it.`,
      [
        declarations.status === "resolved"
          ? `Its admin permissions are ${[...declarations.modules].map(([module, names]) => names.map(name => `${module}.${name}`).join(", ")).join(", ") || "empty"}.`
          : `${declarations.reason}.`,
      ],
      manual,
    );
  }

  return {
    expression: permissionExpression(location.exportName, ref),
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
  if (location.kind === "absent") {
    return { modules: new Map(), status: "resolved" };
  }

  const { staff } = location;
  const admin = effectiveProperty(staff, "admin");
  if (admin.kind === "unsafe") {
    return {
      reason: `in defineStaffPermissions (${locate(location.parsed, admin.at)}), ${admin.reason}`,
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
      reason: "the admin permissions are not a plain object literal",
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
        reason: "the admin permissions have a computed key, getter or method",
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
        reason: `admin.${key ?? "?"} is not an array literal`,
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
            reason: `an entry of admin.${key} has no literal permission`,
            status: "unresolved",
          };
        }
        names.push(permission);
      } else {
        return {
          reason: `admin.${key} has an entry that is not a literal`,
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

/**
 * Creates `src/staff-permissions.ts` with `ref` as its only permission and
 * passes it to `buildApiPlugin`, for a plugin that declares none yet.
 */
const planStaffPermissionsModule = (
  ctx: GenerateContext,
  holder: ObjectExpression,
  parsed: ParsedSource,
  entry: string,
): void => {
  const { plan, project } = ctx;
  const manual = [
    `Create ${STAFF_PERMISSIONS}:`,
    `  export const ${STAFF_PERMISSIONS_EXPORT} = defineStaffPermissions(manifest, { admin: { ${entry} } });`,
    `and pass it in ${API_CONFIG}: buildApiPlugin({ ..., permissionStaff: ${STAFF_PERMISSIONS_EXPORT} }).`,
  ];

  if (plan.exists(STAFF_PERMISSIONS)) {
    throw new UnsupportedStructureError(
      `${STAFF_PERMISSIONS} exists, but ${API_CONFIG} passes no permissionStaff to buildApiPlugin.`,
      [],
      [
        `Pass its defineStaffPermissions(...) export as permissionStaff in ${API_CONFIG}, then run the command again.`,
      ],
    );
  }
  if (topLevelNames(parsed.program).has(STAFF_PERMISSIONS_EXPORT)) {
    throw new UnsupportedStructureError(
      `${API_CONFIG} already declares ${STAFF_PERMISSIONS_EXPORT}.`,
      [],
      manual,
    );
  }

  plan.create(
    STAFF_PERMISSIONS,
    staffPermissionsTemplate({
      entry,
      exportName: STAFF_PERMISSIONS_EXPORT,
      manifest: specifierFor(project, STAFF_PERMISSIONS, MANIFEST, true),
    }),
    "the plugin's staff permissions",
  );
  plan.update(
    API_CONFIG,
    applyEdits(parsed.source, [
      ...addNamedImport(
        parsed,
        specifierFor(project, API_CONFIG, STAFF_PERMISSIONS, true),
        STAFF_PERMISSIONS_EXPORT,
      ),
      ...addProperty(
        parsed.source,
        holder,
        `permissionStaff: ${STAFF_PERMISSIONS_EXPORT}`,
      ),
    ]),
    "register the plugin's staff permissions",
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

  if (declarations.status === "unresolved") {
    throw new UnsupportedStructureError(
      `Cannot ${declare ? "declare" : "verify"} ${wanted}: ${declarations.reason}.`,
      [
        "Generated routes guard with a typed reference from the plugin's defineStaffPermissions module, so it has to be readable.",
      ],
      [
        `Add ${JSON.stringify(ref.permission)} to admin[${JSON.stringify(ref.module)}] of the plugin's defineStaffPermissions(manifest, {...}) by hand.`,
      ],
    );
  }

  if (declarations.modules.get(ref.module)?.includes(ref.permission) === true)
    return;

  const key = staffPermissionKey(ref.permission);
  const clash = declarations.modules
    .get(ref.module)
    ?.find(name => staffPermissionKey(name) === key);
  if (clash !== undefined) {
    throw new UserError(
      `${wanted} collides with the declared ${ref.module}.${clash}.`,
      {
        details: [
          `Both become the reference ${permissionExpression(STAFF_PERMISSIONS_EXPORT, ref)}, which defineStaffPermissions refuses.`,
        ],
        hint: `Use ${JSON.stringify(clash)}, or pick a name that differs in more than - and _.`,
      },
    );
  }

  if (!declare) {
    if (contentModules && !declarations.modules.has(ref.module)) {
      throw new UserError(
        `The staff permission ${wanted} is not declared by the plugin.`,
        {
          details: [
            `If a content type generates the "${ref.module}" permission module, guard the route by hand with its generated permission:`,
            `  adminStaffPermission: contentAdminStaffPermission(manifest.id, yourContent, ${JSON.stringify(ref.permission)})`,
            `(contentAdminStaffPermission is exported by @vitnode/core/content).`,
          ],
          hint: "Or pass --declare-permission to declare it in the plugin's own permissions.",
        },
      );
    }

    const location = locatePermissionStaff(ctx);
    throw new UserError(`The staff permission ${wanted} is not declared.`, {
      details: [
        `Nobody can be granted a permission the plugin does not declare in ${location.kind === "defined" ? location.file : STAFF_PERMISSIONS} (defineStaffPermissions):`,
        `  admin: { ${entry} }`,
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
        `Add ${JSON.stringify(ref.permission)} to admin[${JSON.stringify(ref.module)}] of the plugin's defineStaffPermissions(manifest, {...}) by hand.`,
      ],
    );
  }

  if (location.kind === "absent") {
    planStaffPermissionsModule(ctx, location.holder, location.parsed, entry);
    planPermissionLabels(ctx, ref);

    return;
  }

  const { parsed, staff } = location;
  const edits: Edit[] = [];
  const manual = [
    `Add ${JSON.stringify(ref.permission)} to admin[${JSON.stringify(ref.module)}] in ${location.file} (the object passed to defineStaffPermissions for ${location.exportName}):`,
    `  admin: { ${entry} }`,
  ];
  const editable = (object: ObjectExpression, name: string, where: string) =>
    withManual(manual, () => editableProperty(parsed, object, name, where));
  const adminProperty = editable(staff, "admin", "defineStaffPermissions");
  const admin = objectValue(adminProperty);
  if (adminProperty !== null && admin === null) {
    throw new UnsupportedStructureError(
      `Cannot declare ${wanted}: the admin permissions are not an object literal.`,
      [`At ${locate(parsed, adminProperty.start)}.`],
      manual,
    );
  }
  const moduleProperty =
    admin === null ? null : editable(admin, ref.module, "admin");
  const moduleEntries = arrayValue(moduleProperty);
  if (moduleProperty !== null && moduleEntries === null) {
    throw new UnsupportedStructureError(
      `Cannot declare ${wanted}: admin[${JSON.stringify(ref.module)}] is not an array literal.`,
      [`At ${locate(parsed, moduleProperty.start)}.`],
      manual,
    );
  }

  if (admin === null) {
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
