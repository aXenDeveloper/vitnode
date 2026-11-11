import { posix } from "node:path";

import type { ModuleSource } from "./api-tree";
import type { GenerateContext } from "./generators";
import type { ResourceField, ResourceNames } from "./resource-templates";
import type { ParamType } from "./templates";

import { isAdminApiPath } from "../../../src/api/lib/route-metadata";
import { UserError } from "../errors";
import {
  editableProperty,
  locate,
  lookupModule,
  specifierFor,
  UnsupportedStructureError,
} from "./api-tree";
import {
  addNamedImport,
  addProperty,
  appendToArray,
  applyEdits,
  arrayValue,
  findConstInit,
  objectArgument,
  parseSource,
  unwrap,
} from "./ast";
import { assertNoEndpointCollisions } from "./endpoints";
import {
  assertFreeName,
  endpointPath,
  permissionSource,
  planModule,
  planPermission,
  readAdminPermissions,
  routeFileFor,
} from "./generators";
import { pascalCase, routeIdentifier, serviceFactoryIdentifier } from "./names";
import { API_BUILDERS } from "./project";
import {
  RESOURCE_OPERATIONS,
  resourceRouteTemplate,
  resourceSchemaTemplate,
  resourceServiceTemplate,
} from "./resource-templates";

export interface ApiResourceOptions {
  fields: readonly ResourceField[];
  idType: ParamType;
  parents: boolean;
  permissions?: { declare: boolean; module: string };
}

export interface ApiResourceResult {
  files: { routes: string[]; schema: string; service: string };
  names: ResourceNames;
}

const namesFor = (modulePath: readonly string[]): ResourceNames => {
  const leaf = modulePath[modulePath.length - 1] ?? "";
  const pascal = pascalCase(leaf);

  return {
    createSchema: `zod${pascal}CreateBody`,
    createType: `${pascal}CreateInput`,
    factory: serviceFactoryIdentifier(modulePath),
    itemSchema: `zod${pascal}Item`,
    itemType: `${pascal}Item`,
    label: modulePath.join("/"),
    leaf,
    notImplementedError: `${pascal}NotImplementedError`,
    updateSchema: `zod${pascal}UpdateBody`,
    updateType: `${pascal}UpdateInput`,
  };
};

export const planApiResource = (
  ctx: GenerateContext,
  modulePath: readonly string[],
  options: ApiResourceOptions,
): ApiResourceResult => {
  const { plan, project } = ctx;
  const names = namesFor(modulePath);
  const isAdmin = isAdminApiPath(modulePath.join("/"));

  if (isAdmin && options.permissions === undefined) {
    throw new UserError("An admin resource needs --permission-module.", {
      details: [
        "Each operation is guarded by its own permission in that module:",
        "  list, show → can_view   create → can_create   update → can_edit   delete → can_delete",
      ],
    });
  }

  if (options.permissions !== undefined) {
    const { declare, module } = options.permissions;
    const wanted = [
      ...new Set(RESOURCE_OPERATIONS.map(operation => operation.permission)),
    ];
    const declarations = readAdminPermissions(ctx);
    const declared =
      declarations.status === "resolved"
        ? new Set(declarations.modules.get(module))
        : null;
    const missing =
      declared === null ? [] : wanted.filter(name => !declared.has(name));

    if (!declare && missing.length > 0) {
      throw new UserError(
        `${missing.map(name => `${module}.${name}`).join(", ")} ${missing.length === 1 ? "is" : "are"} not declared.`,
        {
          details: [
            `Nobody can be granted a permission the plugin does not declare in admin[${JSON.stringify(module)}] of its defineStaffPermissions(manifest, {...}).`,
          ],
          hint: "Pass --declare-permission to add them (and their labels).",
        },
      );
    }

    for (const permission of wanted) {
      planPermission(
        ctx,
        { module, permission },
        { contentModules: false, declare },
      );
    }
  }

  const lookup = lookupModule(plan, project, modulePath);
  let module: ModuleSource;
  if (lookup.status === "found") {
    module = lookup.module;
  } else {
    module = planModule(ctx, modulePath, { parents: options.parents });
  }

  const routesProperty = editableProperty(
    module.parsed,
    module.options,
    "routes",
    `module "${names.label}"`,
  );
  const routes = arrayValue(routesProperty);
  if (routesProperty !== null && routes === null) {
    throw new UnsupportedStructureError(
      `The routes of module "${names.label}" are not an array literal.`,
      [`At ${locate(module.parsed, routesProperty.start)}.`],
    );
  }
  if (routes !== null && routes.elements.length > 0) {
    throw new UserError(`Module "${names.label}" already has routes.`, {
      details: [
        "A resource scaffold owns its module's list/show/create/update/delete routes.",
        "Generate it into a new module, or add single routes with vitnode g route.",
      ],
    });
  }

  assertNoEndpointCollisions(
    ctx,
    RESOURCE_OPERATIONS.map(operation => ({
      file: routeFileFor(module, operation.name),
      identifier: routeIdentifier(operation.name, modulePath),
      method: operation.method,
      modulePath,
      routePath: operation.path,
    })),
  );

  for (const operation of RESOURCE_OPERATIONS) {
    assertFreeName(module.parsed, routeIdentifier(operation.name, modulePath));
  }

  const schema = posix.join(module.dir, `${names.leaf}.schema.ts`);
  const service = posix.join(module.dir, `${names.leaf}.service.ts`);

  plan.create(
    schema,
    resourceSchemaTemplate({
      fields: options.fields,
      idType: options.idType,
      names,
    }),
    `schemas for the ${names.label} resource`,
  );
  plan.create(
    service,
    resourceServiceTemplate({
      idType: options.idType,
      names,
      schemaSpecifier: specifierFor(project, service, schema, false),
    }),
    `service stubs for the ${names.label} resource`,
  );

  const routeFiles: string[] = [];
  const identifiers: string[] = [];
  let source = module.parsed.source;

  for (const operation of RESOURCE_OPERATIONS) {
    const identifier = routeIdentifier(operation.name, modulePath);
    const file = routeFileFor(module, operation.name);
    const endpoint = `${operation.method.toUpperCase()} ${endpointPath(modulePath, operation.path)}`;

    plan.create(
      file,
      resourceRouteTemplate({
        builders: specifierFor(project, file, API_BUILDERS, true),
        endpoint,
        factorySpecifier: specifierFor(project, file, service, false),
        identifier,
        idType: options.idType,
        names,
        operation: operation.name,
        permission:
          options.permissions === undefined
            ? undefined
            : {
                module: options.permissions.module,
                permission: operation.permission,
              },
        permissionSource:
          options.permissions === undefined
            ? undefined
            : permissionSource(ctx, file, {
                module: options.permissions.module,
                permission: operation.permission,
              }),
        schemaSpecifier: specifierFor(project, file, schema, false),
      }),
      endpoint,
    );
    routeFiles.push(file);
    identifiers.push(identifier);
    source = applyEdits(
      source,
      addNamedImport(
        parseSource(module.file, source),
        specifierFor(project, module.file, file, false),
        identifier,
      ),
    );
  }

  const parsed = parseSource(module.file, source);
  const init = findConstInit(parsed.program, module.exportName);
  const call = init === null ? null : unwrap(init);
  const moduleOptions =
    call?.type === "CallExpression" ? objectArgument(call) : null;
  if (moduleOptions === null) {
    throw new UnsupportedStructureError(
      `Module "${names.label}" could not be read back.`,
      [`File: ${module.file}`],
    );
  }

  const list = identifiers.join(", ");
  const current = arrayValue(
    editableProperty(
      parsed,
      moduleOptions,
      "routes",
      `module "${names.label}"`,
    ),
  );
  source = applyEdits(
    source,
    current === null
      ? addProperty(source, moduleOptions, `routes: [${list}]`, "name")
      : appendToArray(source, current, list),
  );
  plan.update(
    module.file,
    source,
    `register the ${names.label} resource routes`,
  );

  return { files: { routes: routeFiles, schema, service }, names };
};
