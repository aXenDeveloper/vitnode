import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type { PluginApiLoad } from "../inspect/api-metadata";
import type { LoadConfiguredPluginIds } from "../plugins/discover";
import type {
  ModuleImporter,
  PluginCheck,
  PluginValidation,
} from "../plugins/validate";

import { describeNestedRegistration } from "../../../src/api/lib/nested-registrations";
import { isAdminApiPath } from "../../../src/api/lib/route-metadata";
import { EXIT_CODE, UserError, ValidationError } from "../errors";
import {
  diagnosticTargets,
  loadPluginApi,
  pluginApiFromDefinition,
} from "../inspect/api-metadata";
import {
  appRegistrationCheck,
  registrationCheck,
  registryCheck,
} from "../inspect/static-checks";
import { findAppRoot } from "../plugins/discover";
import { validatePlugin } from "../plugins/validate";
import { findWorkspaceRoot } from "../plugins/workspace";
import { plural, toDisplayPath } from "../ui/format";
import { renderCheck } from "./plugin-validate";

export interface DoctorOptions extends OutputOptions {
  name?: string;
}

const PERMISSIONS_CHECK = "Staff permissions";
const ENDPOINTS_CHECK = "Endpoints";
const BACKGROUND_CHECK = "Background registrations";
const METADATA_CHECKS = [PERMISSIONS_CHECK, ENDPOINTS_CHECK, BACKGROUND_CHECK];

const metadataChecks = (
  id: string,
  load: PluginApiLoad | { status: "failed" },
): PluginCheck[] => {
  if (load.status === "failed") {
    return METADATA_CHECKS.map(name => ({
      details: ["API definition failed - see above."],
      name,
      status: "skipped",
      summary: "API definition failed",
    }));
  }

  if (load.status !== "loaded") {
    return METADATA_CHECKS.map(name =>
      load.status === "error" && name === PERMISSIONS_CHECK
        ? { details: load.reason.split("\n"), name, status: "error" }
        : {
            details: [],
            name,
            status: "skipped",
            summary:
              load.status === "skipped"
                ? load.reason
                : `needs the API definition, which did not load (see ${PERMISSIONS_CHECK})`,
          },
    );
  }

  const { ignored, permissionStaff, routes } = load.metadata;
  const declared = {
    admin: new Map(
      Object.entries(permissionStaff.admin).map(([module, list]) => [
        module,
        new Set(list),
      ]),
    ),
    moderator: new Map(
      Object.entries(permissionStaff.moderator).map(([module, list]) => [
        module,
        new Set(list),
      ]),
    ),
  };

  const undeclared: string[] = [];
  const unguarded: string[] = [];
  for (const route of routes) {
    const label = `${route.method} /${id}${route.path}`;
    for (const [type, ref] of [
      ["admin", route.admin],
      ["moderator", route.moderator],
    ] as const) {
      if (ref === undefined || (ref.plugin !== undefined && ref.plugin !== id))
        continue;
      if (declared[type].get(ref.module)?.has(ref.permission) !== true) {
        undeclared.push(
          `${label} requires the ${type} permission ${ref.module}.${ref.permission}, which the plugin does not declare in permissionStaff.${type}.`,
        );
      }
    }
    if (isAdminApiPath(route.modulePath) && route.admin === undefined) {
      unguarded.push(
        `${label} is under admin/ but has no adminStaffPermission.`,
      );
    }
  }

  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const route of routes) {
    const key = `${route.method} ${route.path.replace(/\{[^}]*\}/g, "{}")}`;
    const label = `${route.method} /${id}${route.path}`;
    const previous = seen.get(key);
    if (previous === undefined) seen.set(key, label);
    else
      duplicates.push(
        `${label} is declared twice (also ${previous}); only the first one answers.`,
      );
  }

  return [
    undeclared.length > 0
      ? {
          details: [...undeclared, ...unguarded],
          name: PERMISSIONS_CHECK,
          status: "error",
        }
      : unguarded.length > 0
        ? { details: unguarded, name: PERMISSIONS_CHECK, status: "warning" }
        : {
            details: [],
            name: PERMISSIONS_CHECK,
            status: "ok",
            summary:
              "declared on buildRoute; checks inside handlers are not visible",
          },
    duplicates.length > 0
      ? { details: duplicates, name: ENDPOINTS_CHECK, status: "error" }
      : {
          details: [],
          name: ENDPOINTS_CHECK,
          status: "ok",
          summary: plural(routes.length, "route"),
        },
    ignored.length > 0
      ? {
          details: ignored.map(describeNestedRegistration),
          name: BACKGROUND_CHECK,
          status: "error",
        }
      : { details: [], name: BACKGROUND_CHECK, status: "ok" },
  ];
};

const reuseValidatedPluginApi = async (
  id: string,
  root: string,
  validated: PluginValidation["api"],
  importModule: ModuleImporter | undefined,
): Promise<PluginApiLoad | { status: "failed" }> => {
  if (validated === undefined) return loadPluginApi(id, root, importModule);
  if (validated.status === "loaded") {
    return pluginApiFromDefinition(id, root, validated.definition);
  }

  return validated;
};

export const runDoctorCommand = async (
  { cwd, ui }: CommandContext,
  { name }: DoctorOptions,
  deps: {
    importModule?: ModuleImporter;
    loadIds?: LoadConfiguredPluginIds;
  } = {},
): Promise<number> => {
  ui.header("Doctor");

  const targets = await diagnosticTargets(cwd, name, deps.loadIds);
  if (name !== undefined && targets.length === 0) {
    throw new UserError(`No plugin named "${name}" was found.`);
  }
  if (targets.length === 0) {
    ui.note("No plugins to check.");
    ui.line();

    return EXIT_CODE.ok;
  }

  const workspaceRoot = findWorkspaceRoot(cwd);
  const appRoot = findAppRoot(cwd, workspaceRoot);
  const totals = { error: 0, ok: 0, skipped: 0, warning: 0 };
  const failing: string[] = [];

  for (const [index, target] of targets.entries()) {
    if (index > 0) ui.line();
    const where =
      target.root === null
        ? ""
        : toDisplayPath(relative(cwd, target.root)) || ".";
    ui.line(
      ui.mode === "plain"
        ? `${target.id}${where ? ` (${where})` : ""}`
        : `  ${ui.colors.bold(target.id)}  ${ui.colors.muted(where)}`,
    );

    const checks: PluginCheck[] = [];
    if (target.root === null) {
      checks.push({
        details: [
          `${target.id} is configured but not installed - run your package manager's install.`,
        ],
        name: "Package",
        status: "error",
      });
    } else {
      const validation = await validatePlugin(target.root, {
        importModule: deps.importModule,
      });
      checks.push(...validation.checks);
      checks.push(registrationCheck(target.root));
      checks.push(registryCheck(target.root));
      checks.push(
        appRegistrationCheck({
          appRoot,
          configured: target.configured,
          cwd,
          id: target.id,
          root: target.root,
          workspaceRoot,
        }),
      );
      checks.push(
        ...metadataChecks(
          target.id,
          await reuseValidatedPluginApi(
            target.id,
            target.root,
            validation.api,
            deps.importModule,
          ),
        ),
      );
    }

    checks.forEach(check => {
      totals[check.status] += 1;
      renderCheck(ui, check);
    });
    if (checks.some(check => check.status === "error")) failing.push(target.id);
  }

  ui.line();
  ui.note(
    `${plural(totals.ok, "check")} passed, ${plural(totals.warning, "warning")}, ${String(totals.error)} failed, ${String(totals.skipped)} skipped.`,
  );
  ui.line();

  if (failing.length > 0) {
    throw new ValidationError(
      `${plural(failing.length, "plugin")} with problems: ${failing.join(", ")}`,
    );
  }

  ui.success(
    totals.warning > 0
      ? "No errors - see the warnings above"
      : "Everything checked is fine",
  );
  ui.line();

  return EXIT_CODE.ok;
};
