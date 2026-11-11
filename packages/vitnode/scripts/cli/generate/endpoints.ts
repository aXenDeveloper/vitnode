import type { ArrayExpression, Expression } from "oxc-parser";

import type { ParsedSource } from "./ast";
import type { GenerateContext } from "./generators";
import type { GenerationPlan } from "./plan";
import type { GeneratorProject } from "./project";

import { UserError } from "../errors";
import {
  editableProperty,
  locate,
  readModuleContainer,
  readParsed,
  readRootContainer,
  resolveBinding,
  UnsupportedStructureError,
} from "./api-tree";
import {
  arrayValue,
  findConstInit,
  objectArgument,
  stringValue,
  unwrap,
} from "./ast";
import { effectiveProperty } from "./effective-property";

const mergePath = (base: string, sub: string): string =>
  `${base.startsWith("/") ? "" : "/"}${base}${
    sub === "/"
      ? ""
      : `${base.endsWith("/") ? "" : "/"}${sub.startsWith("/") ? sub.slice(1) : sub}`
  }`;

export const joinEndpointPath = (
  modulePath: readonly string[],
  routePath: string,
): string =>
  modulePath.reduceRight(
    (path, name) => mergePath(mergePath("/", `/${name}`), path),
    mergePath("/", routePath),
  );

const pathKey = (path: string): string =>
  path.replace(/\{[^}]*\}/g, "{}").replace(/\/:[^/]+/g, "/{}");

/**
 * What makes two endpoints the same route: the method in any case, and the
 * path with every parameter (`{id}`, `{noteId}`, `:id`) reduced to one
 * placeholder, since Hono matches them alike.
 */
export const endpointKey = (method: string, path: string): string =>
  `${method.toLowerCase()} ${pathKey(path)}`;

export interface DeclaredEndpoint {
  file: string;
  identifier: string;
  method: string;
  modulePath: string[];
  path: string;
}

export interface UnverifiedRegion {
  prefix: string;
  reason: string;
}

export interface EndpointInventory {
  endpoints: DeclaredEndpoint[];
  unverified: UnverifiedRegion[];
}

const MAX_SPREAD_DEPTH = 8;

const MAX_MOUNTS = 2000;

export const collectEndpoints = (
  plan: GenerationPlan,
  project: GeneratorProject,
): EndpointInventory => {
  const endpoints: DeclaredEndpoint[] = [];
  const unverified: UnverifiedRegion[] = [];
  const mounted = new Set<string>();
  let mounts = 0;
  const prefixOf = (modulePath: readonly string[]) =>
    joinEndpointPath(modulePath, "/");

  const unreadable = (
    modulePath: readonly string[],
    where: string,
    reason: string,
  ) => {
    unverified.push({
      prefix: prefixOf(modulePath),
      reason: `${where}: ${reason.replace(/\.$/, "")}`,
    });
  };

  const readRoute = (
    parsed: ParsedSource,
    element: Expression,
    modulePath: readonly string[],
    depth: number,
  ): void => {
    const value = unwrap(element);
    let call: Expression | null = null;
    let identifier = parsed.source.slice(value.start, value.end);
    let file = parsed.path;
    const site = locate(parsed, value.start);

    if (value.type === "CallExpression") {
      call = value;
    } else if (value.type === "Identifier") {
      const binding = resolveBinding(plan, project, parsed, value.name);
      if (typeof binding === "string") {
        unreadable(modulePath, `${value.name} in ${parsed.path}`, binding);

        return;
      }
      const declared = readParsed(plan, binding.file);
      const init = findConstInit(declared.program, binding.exportName);
      if (init === null) {
        unreadable(
          modulePath,
          `${value.name} in ${parsed.path}`,
          `${binding.file} does not declare const ${binding.exportName}`,
        );

        return;
      }
      identifier = binding.exportName;
      file = binding.file;
      call = unwrap(init);
      if (call.type === "ArrayExpression" && depth < MAX_SPREAD_DEPTH) {
        readRoutes(declared, call, modulePath, depth + 1);

        return;
      }
    }

    const options =
      call?.type === "CallExpression" &&
      call.callee.type === "Identifier" &&
      call.callee.name === "buildRoute"
        ? objectArgument(call)
        : null;
    const routeProperty =
      options === null ? null : effectiveProperty(options, "route");
    let route =
      routeProperty?.kind === "property"
        ? unwrap(routeProperty.property.value)
        : null;
    if (
      route?.type === "CallExpression" &&
      route.callee.type === "Identifier" &&
      route.callee.name === "createRoute"
    ) {
      route = objectArgument(route);
    }
    const method =
      route?.type === "ObjectExpression"
        ? effectiveProperty(route, "method")
        : null;
    const path =
      route?.type === "ObjectExpression"
        ? effectiveProperty(route, "path")
        : null;
    const methodValue =
      method?.kind === "property" ? stringValue(method.property) : null;
    const pathValue =
      path?.kind === "property" ? stringValue(path.property) : null;

    if (methodValue === null || pathValue === null) {
      unreadable(
        modulePath,
        `${identifier} at ${site}`,
        "its method and path are not literals in a buildRoute({ route: { method, path } }) call",
      );

      return;
    }

    endpoints.push({
      file,
      identifier,
      method: methodValue.toLowerCase(),
      modulePath: [...modulePath],
      path: joinEndpointPath(modulePath, pathValue),
    });
  };

  const readRoutes = (
    parsed: ParsedSource,
    array: ArrayExpression,
    modulePath: readonly string[],
    depth: number,
  ): void => {
    for (const element of array.elements) {
      if (element === null) continue;
      if (element.type === "SpreadElement") {
        const argument = unwrap(element.argument);
        if (
          argument.type === "Identifier" ||
          argument.type === "ArrayExpression"
        ) {
          if (argument.type === "ArrayExpression") {
            readRoutes(parsed, argument, modulePath, depth + 1);
          } else {
            readRoute(parsed, argument, modulePath, depth);
          }
        } else {
          unreadable(
            modulePath,
            locate(parsed, element.start),
            "a spread the generator cannot follow",
          );
        }
        continue;
      }
      readRoute(parsed, element, modulePath, depth);
    }
  };

  const visitContainer = (
    container: ReturnType<typeof readRootContainer>,
    modulePath: readonly string[],
    ancestry: readonly string[],
  ): void => {
    for (const entry of container.entries) {
      if (entry.kind === "unresolved") {
        unreadable(
          modulePath,
          `${entry.label} in ${container.file}`,
          entry.reason,
        );
      } else if (entry.kind === "fixed") {
        unreadable(
          [...modulePath, entry.name],
          entry.label,
          "generated by the Content Engine at runtime",
        );
      } else {
        const { source } = entry;
        const path = [...modulePath, source.name];
        const id = `${source.file}#${source.exportName}`;

        if (ancestry.includes(id)) {
          unreadable(
            path,
            `${source.exportName} in ${source.file}`,
            `it mounts itself through ${[
              ...ancestry.slice(ancestry.indexOf(id)),
              id,
            ]
              .map(item => item.slice(item.indexOf("#") + 1))
              .join(" > ")}, so its routes cannot be listed`,
          );
          continue;
        }

        const mount = `${id}@${prefixOf(path)}`;
        if (mounted.has(mount)) continue;
        mounted.add(mount);

        mounts += 1;
        if (mounts > MAX_MOUNTS) {
          unreadable(
            path,
            `${source.exportName} in ${source.file}`,
            `the module tree has more than ${String(MAX_MOUNTS)} mounts, so the rest was not read`,
          );
          continue;
        }

        try {
          const routes = editableProperty(
            source.parsed,
            source.options,
            "routes",
            `module "${path.join("/")}"`,
          );
          const array = arrayValue(routes);
          if (routes !== null && array === null) {
            unreadable(
              path,
              locate(source.parsed, routes.start),
              "routes is not an array literal",
            );
          } else if (array !== null) {
            readRoutes(source.parsed, array, path, 0);
          }
          visitContainer(readModuleContainer(plan, project, source), path, [
            ...ancestry,
            id,
          ]);
        } catch (error) {
          if (!(error instanceof UnsupportedStructureError)) throw error;
          unreadable(path, source.file, error.summary);
        }
      }
    }
  };

  try {
    visitContainer(readRootContainer(plan, project), [], []);
  } catch (error) {
    if (!(error instanceof UnsupportedStructureError)) throw error;
    unverified.push({ prefix: "/", reason: error.summary.replace(/\.$/, "") });
  }

  return { endpoints, unverified };
};

export interface ProposedEndpoint {
  file: string;
  identifier: string;
  method: string;
  modulePath: readonly string[];
  routePath: string;
}

const isUnder = (path: string, prefix: string) =>
  prefix === "/" || path === prefix || path.startsWith(`${prefix}/`);

export const assertNoEndpointCollisions = (
  ctx: GenerateContext,
  proposed: readonly ProposedEndpoint[],
): void => {
  const { endpoints, unverified } = collectEndpoints(ctx.plan, ctx.project);
  const known = new Map<string, DeclaredEndpoint & { planned: boolean }>();
  for (const endpoint of endpoints) {
    const key = endpointKey(endpoint.method, endpoint.path);
    if (!known.has(key)) known.set(key, { ...endpoint, planned: false });
  }

  const paths: string[] = [];
  for (const endpoint of proposed) {
    const path = joinEndpointPath(endpoint.modulePath, endpoint.routePath);
    const label = `${endpoint.method.toUpperCase()} ${path}`;
    const destination = `Destination: ${endpoint.identifier} in ${endpoint.file} (module "${endpoint.modulePath.join("/")}", path ${endpoint.routePath}).`;
    const existing = known.get(endpointKey(endpoint.method, path));

    if (existing !== undefined) {
      throw new UserError(`${label} already exists.`, {
        details: [
          existing.planned
            ? `This command would declare it twice: ${existing.identifier} in ${existing.file} answers ${existing.method.toUpperCase()} ${existing.path}.`
            : `${existing.identifier} in ${existing.file} (module "${existing.modulePath.join("/")}") answers ${existing.method.toUpperCase()} ${existing.path}.`,
          destination,
          ...(existing.path === path
            ? []
            : [
                "Path parameters match whatever their names: /{id} and /{noteId} are the same route.",
              ]),
          "Nothing was written.",
        ],
        hint: "Pick another --path, --method or module.",
      });
    }

    known.set(endpointKey(endpoint.method, path), {
      file: endpoint.file,
      identifier: endpoint.identifier,
      method: endpoint.method,
      modulePath: [...endpoint.modulePath],
      path,
      planned: true,
    });
    paths.push(path);
  }

  const reported = new Set<string>();
  for (const region of unverified) {
    const affected = proposed.filter((_, index) =>
      isUnder(paths[index] ?? "", region.prefix),
    );
    if (affected.length === 0) continue;
    const message = `Could not verify that nothing under ${region.prefix} already answers ${affected
      .map(
        endpoint =>
          `${endpoint.method.toUpperCase()} ${joinEndpointPath(endpoint.modulePath, endpoint.routePath)}`,
      )
      .join(", ")} - ${region.reason}. Check it by hand.`;
    if (reported.has(message)) continue;
    reported.add(message);
    ctx.warnings.push(message);
  }
};
