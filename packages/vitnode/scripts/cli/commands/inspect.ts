import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type {
  InspectedPermissionRef,
  PayloadContract,
  PluginApiLoad,
  PluginApiMetadata,
} from "../inspect/api-metadata";
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
  ref?: InspectedPermissionRef,
) =>
  ref === undefined
    ? null
    : `${type} ${ref.plugin !== undefined && ref.plugin !== pluginId ? `${ref.plugin}:` : ""}${ref.module}.${ref.permission}${
        ref.staffType !== undefined && ref.staffType !== type
          ? ` (${ref.staffType} ref - wrong staff type)`
          : ""
      }`;

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

const PAYLOAD_LABEL: Record<PayloadContract, string> = {
  none: "none (untyped)",
  schema: "payload schema",
};

const renderJobs = (ui: Ui, metadata: PluginApiMetadata) => {
  if (metadata.jobs.length === 0) ui.note("No cron jobs or queue tasks.");
  else {
    ui.table({
      columns: [
        { header: "Kind" },
        { header: "Name" },
        { header: "Owner" },
        { header: "Contract" },
        { header: "Schedule" },
        { header: "Module" },
      ],
      rows: metadata.jobs.map(job => [
        job.kind,
        job.name,
        job.owner,
        job.payload === undefined
          ? ui.colors.muted("-")
          : PAYLOAD_LABEL[job.payload],
        job.schedule ?? ui.colors.muted("-"),
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
        { header: "Event owner" },
        { header: "Contract" },
        { header: "Listener" },
        { header: "Module" },
      ],
      rows: metadata.listeners.map(listener => [
        listener.kind,
        listener.event,
        listener.eventOwner ?? ui.colors.muted("-"),
        listener.payload === undefined
          ? ui.colors.muted("-")
          : PAYLOAD_LABEL[listener.payload],
        listener.name ?? ui.colors.muted("-"),
        listener.module,
      ]),
    });
  }

  ui.line();
  if (metadata.eventDefinitions.length === 0) {
    ui.note("No event definitions in buildApiPlugin({ eventDefinitions }).");
  } else {
    ui.table({
      columns: [
        { header: "Event definition" },
        { header: "Owner" },
        { header: "Contract" },
      ],
      rows: metadata.eventDefinitions.map(event => [
        event.name,
        event.owner,
        PAYLOAD_LABEL[event.payload],
      ]),
    });
  }
};

const IGNORED_KINDS: Record<Section, ReadonlySet<string>> = {
  events: new Set(["events", "webSockets"]),
  jobs: new Set(["cronJobs", "queueTasks"]),
  routes: new Set(),
};

const renderIgnored = (
  ui: Ui,
  id: string,
  metadata: PluginApiMetadata,
  section: Section,
) => {
  const ignored = metadata.ignored.filter(item =>
    IGNORED_KINDS[section].has(item.kind),
  );
  if (ignored.length === 0) return;

  ui.line();
  ui.warning(`Ignored - ${plural(ignored.length, "registration")} never run`);
  for (const entry of ignored) {
    ui.line(`    ${describeNestedRegistration(entry, id)}`);
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
    renderIgnored(ui, target.id, load.metadata, section);
  }

  ui.line();
  ui.note(
    section === "routes"
      ? "Read from each plugin's build output; declarations only. Paths are under the app's API base path (/api in the starter apps). Staff permissions are the guards declared on buildRoute - access checks inside handlers or middleware are not listed."
      : "Read from each plugin's build output; declarations only. Each plugin's buildApiPlugin factory was called, but no handler ran and nothing was scheduled or sent.",
  );
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
