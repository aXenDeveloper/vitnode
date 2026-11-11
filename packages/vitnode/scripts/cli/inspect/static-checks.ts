import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";

import type { ModuleSource } from "../generate/api-tree";
import type { PluginCheck } from "../plugins/validate";

import { errorMessage } from "../errors";
import {
  readModuleContainer,
  readParsed,
  readRootContainer,
  resolveBinding,
} from "../generate/api-tree";
import {
  arrayValue,
  getProperty,
  isExported,
  listImports,
  parseSource,
  unwrap,
} from "../generate/ast";
import { GenerationPlan } from "../generate/plan";
import { API_CONFIG } from "../generate/project";
import { workspacePackageDirs } from "../plugins/workspace";
import { plural } from "../ui/format";

const MODULES_DIR = "src/api/modules";

const sourceFiles = (root: string, dir: string): string[] => {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute).flatMap(entry => {
    const path = posix.join(dir, entry);
    if (statSync(join(root, path)).isDirectory())
      return sourceFiles(root, path);

    return /\.tsx?$/.test(entry) &&
      !/\.(test|spec)\.tsx?$/.test(entry) &&
      !entry.endsWith(".d.ts")
      ? [path]
      : [];
  });
};

const builderExports = (
  plan: GenerationPlan,
  file: string,
  builder: "buildModule" | "buildRoute",
): string[] => {
  const parsed = readParsed(plan, file);

  return parsed.program.body.flatMap(statement => {
    if (statement.type !== "ExportNamedDeclaration") return [];
    if (statement.declaration?.type !== "VariableDeclaration") return [];

    return statement.declaration.declarations.flatMap(declarator => {
      if (declarator.id.type !== "Identifier" || !declarator.init) return [];
      const init = unwrap(declarator.init);

      return init.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        init.callee.name === builder
        ? [declarator.id.name]
        : [];
    });
  });
};

export const registrationCheck = (root: string): PluginCheck => {
  const name = "API registration";
  if (!existsSync(join(root, API_CONFIG))) {
    return {
      details: [],
      name,
      status: "skipped",
      summary: "no src/config.api.ts",
    };
  }

  const plan = new GenerationPlan(root);
  const tsconfig = join(root, "tsconfig.json");
  const project = {
    alias:
      existsSync(tsconfig) &&
      /["']@\/\*["']\s*:/.test(readFileSync(tsconfig, "utf8")),
    display: ".",
    id: "",
    root,
  };
  const reachedModules = new Set<string>();
  const reachedRoutes = new Set<string>();
  const unresolved: string[] = [];

  try {
    const visit = (module: ModuleSource) => {
      const id = `${module.file}#${module.exportName}`;
      if (reachedModules.has(id)) return;
      reachedModules.add(id);

      const routes = arrayValue(getProperty(module.options, "routes"));
      for (const element of routes?.elements ?? []) {
        if (element === null || element.type === "SpreadElement") continue;
        const value = unwrap(element);
        if (value.type !== "Identifier") continue;
        const binding = resolveBinding(
          plan,
          project,
          module.parsed,
          value.name,
        );
        if (typeof binding === "string")
          unresolved.push(`${value.name}: ${binding}`);
        else reachedRoutes.add(`${binding.file}#${binding.exportName}`);
      }

      for (const entry of readModuleContainer(plan, project, module).entries) {
        if (entry.kind === "module") visit(entry.source);
        if (entry.kind === "unresolved")
          unresolved.push(`${entry.label}: ${entry.reason}`);
      }
    };

    for (const entry of readRootContainer(plan, project).entries) {
      if (entry.kind === "module") visit(entry.source);
      if (entry.kind === "unresolved")
        unresolved.push(`${entry.label}: ${entry.reason}`);
    }
  } catch (error) {
    return {
      details: [errorMessage(error)],
      name,
      status: "warning",
      summary: "not verified - the module tree could not be read from source",
    };
  }

  const unregistered: string[] = [];
  for (const file of sourceFiles(root, MODULES_DIR)) {
    let modules: string[];
    let routes: string[];
    try {
      modules = builderExports(plan, file, "buildModule");
      routes = builderExports(plan, file, "buildRoute");
    } catch (error) {
      unresolved.push(`${file}: ${errorMessage(error)}`);
      continue;
    }
    for (const exportName of modules) {
      if (!reachedModules.has(`${file}#${exportName}`)) {
        unregistered.push(
          `Module ${exportName} (${file}) is not registered in any modules array.`,
        );
      }
    }
    for (const exportName of routes) {
      if (!reachedRoutes.has(`${file}#${exportName}`)) {
        unregistered.push(
          `Route ${exportName} (${file}) is not in any registered module's routes.`,
        );
      }
    }
  }

  if (unresolved.length > 0) {
    return {
      details: [
        ...unregistered,
        ...unresolved.map(line => `Not followed: ${line}`),
        "Entries that could not be followed may register more than is reported here.",
      ],
      name,
      status: "warning",
    };
  }

  return unregistered.length > 0
    ? { details: unregistered, name, status: "warning" }
    : {
        details: [],
        name,
        status: "ok",
        summary: `${plural(reachedModules.size, "module")}, ${plural(reachedRoutes.size, "route")} reached`,
      };
};

export const registryCheck = (root: string): PluginCheck => {
  const name = "Fetcher registry";
  if (!existsSync(join(root, API_CONFIG))) {
    return {
      details: [],
      name,
      status: "skipped",
      summary: "no src/config.api.ts",
    };
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  try {
    const parsed = parseSource(
      API_CONFIG,
      readFileSync(join(root, API_CONFIG), "utf8"),
    );
    if (
      !isExported(parsed.program, "VitNodeApiPlugin") &&
      !/export\s+type\s+VitNodeApiPlugin\b/.test(parsed.source)
    ) {
      problems.push(
        `${API_CONFIG} does not export type VitNodeApiPlugin = ApiPluginContract<...>; apps cannot type fetcher calls to this plugin.`,
      );
    }
  } catch (error) {
    problems.push(errorMessage(error));
  }

  if (!existsSync(join(root, "types", "api-registry.gen.d.ts"))) {
    warnings.push(
      "types/api-registry.gen.d.ts is missing - run vitnode build or vitnode dev in the plugin so its own pages can call its API.",
    );
  } else {
    const tsconfig = join(root, "tsconfig.json");
    if (
      existsSync(tsconfig) &&
      !/["']types["']/.test(readFileSync(tsconfig, "utf8"))
    ) {
      warnings.push(
        'tsconfig.json does not include "types", so types/api-registry.gen.d.ts is not loaded.',
      );
    }
  }

  if (problems.length > 0)
    return { details: [...problems, ...warnings], name, status: "error" };
  if (warnings.length > 0)
    return { details: warnings, name, status: "warning" };

  return { details: [], name, status: "ok" };
};

const apiConfigImports = (
  workspaceRoot: null | string,
  appRoot: null | string,
): Map<string, string[]> => {
  const roots = new Set<string>();
  if (appRoot !== null) roots.add(appRoot);
  if (workspaceRoot !== null)
    for (const dir of workspacePackageDirs(workspaceRoot)) roots.add(dir);

  const found = new Map<string, string[]>();
  for (const dir of roots) {
    const file = join(dir, "src", "vitnode.api.config.ts");
    if (!existsSync(file)) continue;
    try {
      const parsed = parseSource(file, readFileSync(file, "utf8"));
      found.set(
        file,
        listImports(parsed.program).map(info => info.source),
      );
    } catch {
      continue;
    }
  }

  return found;
};

export const appRegistrationCheck = ({
  appRoot,
  configured,
  cwd,
  id,
  root,
  workspaceRoot,
}: {
  appRoot: null | string;
  configured: boolean;
  cwd: string;
  id: string;
  root: string;
  workspaceRoot: null | string;
}): PluginCheck => {
  const name = "App registration";
  if (!existsSync(join(root, API_CONFIG))) {
    return {
      details: [],
      name,
      status: "skipped",
      summary: "no API to register",
    };
  }

  const configs = apiConfigImports(workspaceRoot, appRoot);
  if (configs.size === 0) {
    return {
      details: [],
      name,
      status: "skipped",
      summary: "no vitnode.api.config.ts found in this workspace",
    };
  }

  const registeredIn = [...configs].filter(([, sources]) =>
    sources.includes(`${id}/config.api`),
  );
  const where = registeredIn.map(([file]) => relative(cwd, file) || file);

  if (configured && registeredIn.length === 0) {
    return {
      details: [
        `The app configures ${id} in vitnode.config.ts, but no vitnode.api.config.ts imports "${id}/config.api".`,
        "Its pages load, but every call to its API answers 404. Add its API plugin to buildApiConfig({ plugins }).",
      ],
      name,
      status: "error",
    };
  }

  if (!configured && registeredIn.length > 0) {
    return {
      details: [
        `${where.join(", ")} registers the API of ${id}, but the app does not list it in vitnode.config.ts.`,
      ],
      name,
      status: "warning",
    };
  }

  return registeredIn.length === 0
    ? {
        details: [],
        name,
        status: "skipped",
        summary: "not used by an app in this workspace",
      }
    : { details: [], name, status: "ok", summary: where.join(", ") };
};
