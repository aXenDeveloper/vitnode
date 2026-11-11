import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type {
  InspectedPermissionRef,
  PluginApiMetadata,
} from "../inspect/api-metadata";
import type { LoadConfiguredPluginIds } from "../plugins/discover";
import type {
  CheckStatus,
  ModuleImporter,
  PluginCheck,
  ValidatedApi,
} from "../plugins/validate";

import { describeNestedRegistration } from "../../../src/api/lib/nested-registrations";
import { isAdminApiPath } from "../../../src/api/lib/route-metadata";
import { EXIT_CODE, UserError, ValidationError } from "../errors";
import { endpointKey } from "../generate/endpoints";
import {
  diagnosticTargets,
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
  /**
   * Also fail on warnings. Checks that could not run fail in either mode;
   * checks that do not apply to a plugin (it has no API) never do.
   */
  strict?: boolean;
}

const PERMISSIONS_CHECK = "Staff permission guards";
const ENDPOINTS_CHECK = "Endpoints";
const BACKGROUND_CHECK = "Background registrations";
const METADATA_CHECKS = [PERMISSIONS_CHECK, ENDPOINTS_CHECK, BACKGROUND_CHECK];

const GUARD_OPTION = {
  admin: "adminStaffPermission",
  moderator: "moderatorStaffPermission",
} as const;

const permissionsCheck = (
  id: string,
  { permissionStaff, routes }: PluginApiMetadata,
): PluginCheck => {
  const declares = (type: "admin" | "moderator", ref: InspectedPermissionRef) =>
    (permissionStaff[type][ref.module] ?? []).includes(ref.permission);

  const problems: string[] = [];
  const unguarded: string[] = [];
  let guarded = 0;
  let foreign = 0;
  for (const route of routes) {
    const label = `${route.method} /${id}${route.path}`;
    if (route.admin !== undefined || route.moderator !== undefined) {
      guarded += 1;
    }
    for (const [type, ref] of [
      ["admin", route.admin],
      ["moderator", route.moderator],
    ] as const) {
      if (ref === undefined) continue;
      const option = GUARD_OPTION[type];
      const permission = `${ref.module}.${ref.permission}`;
      if (ref.staffType !== undefined && ref.staffType !== type) {
        problems.push(
          `${label}: ${option} is given the ${ref.staffType} permission ${permission}. Pass one from defineStaffPermissions(...).${type} instead.`,
        );
        continue;
      }
      if (ref.plugin !== undefined && ref.plugin !== id) {
        foreign += 1;
        continue;
      }
      if (declares(type, ref)) continue;
      const other = type === "admin" ? "moderator" : "admin";
      problems.push(
        declares(other, ref)
          ? `${label}: ${option} requires ${permission}, which ${id} declares under defineStaffPermissions(manifest, { ${other} }), not { ${type} } - the wrong staff type.`
          : `${label}: ${option} requires ${permission}, which ${id} does not declare in its defineStaffPermissions(manifest, { ${type} }).`,
      );
    }
    if (isAdminApiPath(route.path) && route.admin === undefined) {
      unguarded.push(
        `${label} is under /admin but declares no adminStaffPermission, so any admin can call it.`,
      );
    }
  }

  const scope = `${plural(guarded, "route")} with declared guards; checks inside handlers or middleware not verified${
    foreign > 0
      ? `; ${plural(foreign, "reference")} to other plugins' permissions not verified`
      : ""
  }`;
  const status: CheckStatus =
    problems.length > 0 ? "error" : unguarded.length > 0 ? "warning" : "ok";

  return {
    details: [...problems, ...unguarded],
    name: PERMISSIONS_CHECK,
    status,
    summary: scope,
  };
};

const endpointsCheck = (
  id: string,
  { routes }: PluginApiMetadata,
): PluginCheck => {
  const seen = new Map<string, (typeof routes)[number]>();
  const duplicates: string[] = [];
  for (const route of routes) {
    const key = endpointKey(route.method, route.path);
    const previous = seen.get(key);
    if (previous === undefined) {
      seen.set(key, route);
      continue;
    }
    duplicates.push(
      `${route.method} /${id}${route.path} (module "${route.modulePath}") duplicates ${previous.method} /${id}${previous.path} (module "${previous.modulePath}")${
        previous.path === route.path
          ? ""
          : " - path parameters match whatever their names"
      }. Only the first one answers; change the method or path of the other.`,
    );
  }

  return duplicates.length > 0
    ? { details: duplicates, name: ENDPOINTS_CHECK, status: "error" }
    : {
        details: [],
        name: ENDPOINTS_CHECK,
        status: "ok",
        summary: `${plural(routes.length, "route")}, no duplicates`,
      };
};

const backgroundCheck = (
  id: string,
  { ignored, jobs, listeners }: PluginApiMetadata,
): PluginCheck =>
  ignored.length > 0
    ? {
        details: ignored.map(entry => describeNestedRegistration(entry, id)),
        name: BACKGROUND_CHECK,
        status: "error",
      }
    : {
        details: [],
        name: BACKGROUND_CHECK,
        status: "ok",
        summary: `${plural(jobs.length, "job")}, ${plural(listeners.length, "listener")}, all on top-level modules`,
      };

/**
 * The checks that read the API definition, from the one validation already
 * loaded - the plugin's factory is never called twice.
 */
const metadataChecks = (
  id: string,
  root: string,
  api: ValidatedApi,
): PluginCheck[] => {
  const notRun = (blockedBy: string): PluginCheck[] =>
    METADATA_CHECKS.map(name => ({
      blockedBy,
      details: [],
      name,
      status: "skipped",
    }));

  if (api.status === "absent") {
    return METADATA_CHECKS.map(name => ({
      details: [],
      name,
      status: "skipped",
      summary: "no API (no src/config.api.ts)",
    }));
  }
  if (api.status === "blocked") return notRun(api.blockedBy);

  const load = pluginApiFromDefinition(id, root, api.definition);
  if (load.status !== "loaded") {
    return [
      {
        details: load.reason.split("\n"),
        name: "API metadata",
        status: "error",
      },
      ...notRun("API metadata"),
    ];
  }

  return [
    permissionsCheck(id, load.metadata),
    endpointsCheck(id, load.metadata),
    backgroundCheck(id, load.metadata),
  ];
};

/**
 * `vitnode doctor [name] [--strict]`: validates each plugin, then checks what
 * its build output declares. Exits `1` on an error or a check that could not
 * run; with `--strict`, on a warning too.
 */
export const runDoctorCommand = async (
  { cwd, ui }: CommandContext,
  { name, strict = false }: DoctorOptions,
  deps: {
    importModule?: ModuleImporter;
    loadIds?: LoadConfiguredPluginIds;
  } = {},
): Promise<number> => {
  ui.header(strict ? "Doctor (strict)" : "Doctor");

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
  const totals = { blocked: 0, error: 0, ok: 0, skipped: 0, warning: 0 };
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
      checks.push(
        ...validation.checks,
        registrationCheck(target.root),
        registryCheck(target.root),
        appRegistrationCheck({
          appRoot,
          configured: target.configured,
          cwd,
          id: target.id,
          root: target.root,
          workspaceRoot,
        }),
        ...metadataChecks(target.id, target.root, validation.api),
      );
    }

    for (const check of checks) {
      if (check.status === "skipped" && check.blockedBy !== undefined) {
        totals.blocked += 1;
      } else totals[check.status] += 1;
      renderCheck(ui, check);
    }
    if (
      checks.some(
        check =>
          check.status === "error" ||
          check.blockedBy !== undefined ||
          (strict && check.status === "warning"),
      )
    ) {
      failing.push(target.id);
    }
  }

  ui.line();
  ui.note(
    `${plural(totals.ok, "check")} passed, ${plural(totals.warning, "warning")}, ${String(totals.error)} failed, ${String(totals.blocked)} not run, ${String(totals.skipped)} not applicable.`,
  );
  ui.note(
    "Read from each plugin's build output (dist/), declarations only: staff permission guards declared on buildRoute were checked, access checks inside handlers or middleware were not. Rebuild first - doctor cannot tell whether dist/ is older than src/.",
  );
  ui.line();

  if (failing.length > 0) {
    throw new ValidationError(
      `${plural(failing.length, "plugin")} with problems: ${failing.join(", ")}`,
      {
        hint: strict
          ? "--strict fails on warnings too. Fix them, or run vitnode doctor without --strict to fail on errors only."
          : undefined,
      },
    );
  }

  ui.success(
    totals.warning > 0
      ? "No errors - see the warnings above (--strict fails on them)"
      : "Everything checked is fine",
  );
  ui.line();

  return EXIT_CODE.ok;
};
