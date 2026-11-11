import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type { PluginApiLoad, PluginApiMetadata } from "../inspect/api-metadata";
import type { LoadConfiguredPluginIds } from "../plugins/discover";
import type { ModuleImporter } from "../plugins/validate";
import type { Ui } from "../ui/ui";

import { describeNestedRegistration } from "../../../src/api/lib/nested-registrations";
import { EXIT_CODE, UserError } from "../errors";
import { diagnosticTargets, loadPluginApi } from "../inspect/api-metadata";
import { plural, toDisplayPath } from "../ui/format";

export interface InspectOptions extends OutputOptions {
  name?: string;
}

export interface InspectDeps {
  importModule?: ModuleImporter;
  loadIds?: LoadConfiguredPluginIds;
}

type Section = "events" | "jobs" | "routes";

const TITLES: Record<Section, string> = {
  events: "Inspect event listeners",
  jobs: "Inspect background jobs",
  routes: "Inspect routes",
};

const permissionLabel = (
  pluginId: string,
  type: string,
  ref?: { module: string; permission: string; plugin?: string },
) =>
  ref === undefined
    ? null
    : `${type} ${ref.plugin !== undefined && ref.plugin !== pluginId ? `${ref.plugin}:` : ""}${ref.module}.${ref.permission}`;

const renderRoutes = (ui: Ui, id: string, metadata: PluginApiMetadata) => {
  if (metadata.routes.length === 0) {
    ui.note("No routes.");

    return;
  }

  ui.table({
    columns: [
      { header: "Method" },
      { header: "Path" },
      { header: "Staff permission" },
    ],
    rows: metadata.routes.map(route => [
      route.method,
      `/${id}${route.path}`,
      [
        permissionLabel(id, "admin", route.admin),
        permissionLabel(id, "moderator", route.moderator),
      ]
        .filter(label => label !== null)
        .join(", ") || ui.colors.muted("-"),
    ]),
  });
};

const renderJobs = (ui: Ui, metadata: PluginApiMetadata) => {
  if (metadata.jobs.length === 0) ui.note("No cron jobs or queue tasks.");
  else {
    ui.table({
      columns: [
        { header: "Kind" },
        { header: "Name" },
        { header: "Schedule" },
        { header: "Payload" },
        { header: "Module" },
      ],
      rows: metadata.jobs.map(job => [
        job.kind,
        job.name,
        job.schedule ?? ui.colors.muted("-"),
        job.payload ?? ui.colors.muted("-"),
        job.module,
      ]),
    });
  }
};

const renderListeners = (ui: Ui, metadata: PluginApiMetadata) => {
  if (metadata.listeners.length === 0)
    ui.note("No event listeners or WebSockets.");
  else {
    ui.table({
      columns: [
        { header: "Kind" },
        { header: "Event or id" },
        { header: "Payload" },
        { header: "Module" },
      ],
      rows: metadata.listeners.map(listener => [
        listener.kind,
        listener.event,
        listener.payload ?? ui.colors.muted("-"),
        listener.module,
      ]),
    });
  }
};

const renderIgnored = (
  ui: Ui,
  metadata: PluginApiMetadata,
  section: Section,
) => {
  const kinds = new Set(
    section === "jobs"
      ? ["cronJobs", "queueTasks"]
      : section === "events"
        ? ["events", "webSockets"]
        : [],
  );
  for (const entry of metadata.ignored.filter(item => kinds.has(item.kind))) {
    ui.warning(describeNestedRegistration(entry));
  }
};

const run = async (
  section: Section,
  { cwd, ui }: CommandContext,
  { name }: InspectOptions,
  deps: InspectDeps = {},
): Promise<number> => {
  ui.header(TITLES[section]);

  const targets = await diagnosticTargets(cwd, name, deps.loadIds);
  if (name !== undefined && targets.length === 0) {
    throw new UserError(`No plugin named "${name}" was found.`, {
      hint: "Pass the plugin's package name, or run the command inside the plugin.",
    });
  }
  if (targets.length === 0) {
    ui.note("No plugins to inspect.");
    ui.line();

    return EXIT_CODE.ok;
  }

  let failed = 0;
  for (const [index, target] of targets.entries()) {
    if (index > 0) ui.line();
    const load: PluginApiLoad = await loadPluginApi(
      target.id,
      target.root,
      deps.importModule,
    );
    const where =
      target.root === null
        ? ""
        : toDisplayPath(relative(cwd, target.root)) || ".";
    ui.line(
      ui.mode === "plain"
        ? `${target.id}${where ? ` (${where})` : ""}`
        : `  ${ui.colors.bold(target.id)}  ${ui.colors.muted(where)}`,
    );

    if (load.status !== "loaded") {
      if (load.status === "error") {
        failed += 1;
        ui.error(load.reason);
      } else ui.note(`Skipped: ${load.reason}.`);
      continue;
    }

    if (section === "routes") renderRoutes(ui, target.id, load.metadata);
    if (section === "jobs") renderJobs(ui, load.metadata);
    if (section === "events") renderListeners(ui, load.metadata);
    renderIgnored(ui, load.metadata, section);
  }

  ui.line();
  if (section === "routes") {
    ui.note(
      "Paths are under the app's API base path (/api in the starter apps). Staff permissions are the ones declared on buildRoute; checks inside handlers or custom middleware are not listed.",
    );
  } else {
    ui.note(
      "Read from each plugin's build output. Nothing was scheduled, run or sent.",
    );
  }
  ui.line();

  if (failed > 0) {
    ui.error(`${plural(failed, "plugin")} could not be loaded.`);
    ui.line();

    return EXIT_CODE.failure;
  }

  return EXIT_CODE.ok;
};

export const runInspectRoutesCommand = async (
  context: CommandContext,
  options: InspectOptions,
  deps?: InspectDeps,
) => run("routes", context, options, deps);

export const runInspectJobsCommand = async (
  context: CommandContext,
  options: InspectOptions,
  deps?: InspectDeps,
) => run("jobs", context, options, deps);

export const runInspectEventsCommand = async (
  context: CommandContext,
  options: InspectOptions,
  deps?: InspectDeps,
) => run("events", context, options, deps);
