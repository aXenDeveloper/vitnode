import type { CommandContext, OutputOptions } from "../context";
import type { DatabaseHandle, DatabaseServices } from "../db/database";
import type { DrizzleStatement, MissingHint } from "../db/statements";
import type { Ui } from "../ui/ui";

import {
  createDatabaseServices,
  explain,
  PROVIDER_NAMES,
} from "../db/database";
import { computeMigrationState, readJournal } from "../db/migration-state";
import {
  formatHintEntity,
  isDataLossHint,
  summarizeStatement,
} from "../db/statements";
import {
  EXIT_CODE,
  rootCauseMessage,
  RuntimeError,
  UserError,
} from "../errors";
import { requireDatabaseProject } from "../project/project";
import { withQuietOutput } from "../ui/capture-output";
import { plural } from "../ui/format";
import { requireConfirmation } from "../ui/prompts";

export interface DbOptions extends OutputOptions {
  acceptDataLoss?: boolean;
  force?: boolean;
  name?: string;
  yes?: boolean;
}

type Services = (root: string) => DatabaseServices;

const servicesFor = (context: CommandContext, create?: Services) => {
  const project = requireDatabaseProject(context.cwd);

  return {
    project,
    services: (create ?? createDatabaseServices)(project.root),
  };
};

const renderStatements = (ui: Ui, statements: readonly DrizzleStatement[]) => {
  const { colors } = ui;
  const lines = statements.map(summarizeStatement);
  const shown = ui.verbose ? lines : lines.slice(0, 25);

  shown.forEach(({ kind, name, sign }) => {
    const paint =
      sign === "+"
        ? colors.success
        : sign === "-"
          ? colors.error
          : colors.warning;
    ui.line(`  ${paint(sign)} ${kind} ${colors.bold(name)}`);
  });
  if (shown.length < lines.length) {
    ui.note(
      `… and ${String(lines.length - shown.length)} more (--verbose lists all)`,
    );
  }
};

const renderHints = (ui: Ui, hints: readonly MissingHint[]) => {
  hints.forEach(hint => {
    const entity = formatHintEntity(hint.entity);
    ui.line(
      isDataLossHint(hint)
        ? `  ${ui.colors.error(ui.symbols.warning)} ${hint.kind ?? "entity"} ${ui.colors.bold(entity)} ${ui.colors.muted(`(${hint.reason?.replaceAll("_", " ") ?? "data loss"})`)}`
        : `  ${ui.colors.warning("?")} ${hint.kind ?? "entity"} ${ui.colors.bold(entity)} ${ui.colors.muted("- renamed, or created new?")}`,
    );
  });
};

export const runDbGenerateCommand = async (
  context: CommandContext,
  options: DbOptions,
  { services: create }: { services?: Services } = {},
): Promise<number> => {
  const { ui } = context;
  ui.header("Database");

  const { services } = servicesFor(context, create);
  const config = await services.drizzleConfig();
  const nameArgs = options.name === undefined ? [] : ["--name", options.name];

  await ui.runTask("Checking migration history", async () =>
    explain(services, ["up", "--output", "json"]),
  );
  const planned = await ui.runTask(
    "Comparing schema with the last migration",
    async () =>
      explain(services, [
        "generate",
        "--explain",
        "--output",
        "json",
        ...nameArgs,
      ]),
  );

  const statements = planned.status === "ok" ? (planned.statements ?? []) : [];
  if (
    planned.status === "no_changes" ||
    (planned.status === "ok" && statements.length === 0)
  ) {
    ui.success("No schema changes - nothing to generate.");
    ui.note(
      "Changed a plugin's tables? Migrations are generated from built schemas - run vitnode build in the plugin first.",
    );
    ui.line();

    return EXIT_CODE.ok;
  }

  const before = new Set(
    services.listMigrationFolders(config.migrationsFolder),
  );

  if (planned.status === "missing_hints") {
    ui.section("Schema changes need a decision");
    renderHints(ui, planned.unresolved);

    if (!ui.interactive) {
      throw new UserError("drizzle-kit has to ask whether these are renames.", {
        hint: "Run vitnode db generate in an interactive terminal and answer its questions.",
      });
    }
    ui.line();
    const { code } = await services.drizzleKit(["generate", ...nameArgs], {
      capture: false,
    });
    if (code !== 0) {
      throw new RuntimeError(
        `drizzle-kit generate exited with code ${String(code)}.`,
      );
    }
  } else {
    ui.section("Schema changes detected");
    renderStatements(ui, statements);
    ui.line();
    await ui.runTask("Generating migration", async () =>
      explain(services, ["generate", "--output", "json", ...nameArgs]),
    );
  }

  const created = services
    .listMigrationFolders(config.migrationsFolder)
    .filter(folder => !before.has(folder));

  ui.line();
  created.forEach(folder => {
    ui.success(folder);
  });
  ui.note(`Apply it with ${ui.colors.command("vitnode db migrate")}.`);
  ui.line();

  return EXIT_CODE.ok;
};

const connect = async (
  ui: Ui,
  services: DatabaseServices,
  config: Awaited<ReturnType<DatabaseServices["drizzleConfig"]>>,
): Promise<DatabaseHandle> =>
  ui.runTask("Connecting to the database", async () => {
    const handle = await services.open(config);
    try {
      await handle.ping();
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw new RuntimeError("Could not connect to the database.", {
        cause: error,
        details: [rootCauseMessage(error)],
        hint: "Is it running? In development, pnpm docker:dev starts one.",
      });
    }

    return handle;
  });

export const runDbMigrateCommand = async (
  context: CommandContext,
  options: DbOptions,
  { services: create }: { services?: Services } = {},
): Promise<number> => {
  const { prompter, ui } = context;
  ui.header("Database migration");

  const { services } = servicesFor(context, create);
  const config = await services.drizzleConfig();
  const local = await services.readLocalMigrations(config.migrationsFolder);
  const handle = await connect(ui, services, config);

  try {
    const journal = await readJournal(handle.query, {
      schema: config.migrationsSchema,
      table: config.migrationsTable,
    });
    const { pending } = computeMigrationState(local, journal);

    if (pending.length === 0) {
      ui.success("Database is up to date.");
      ui.line();

      return EXIT_CODE.ok;
    }

    ui.section("Pending migrations");
    pending.forEach(migration => {
      ui.line(`  ${ui.colors.muted(ui.symbols.pending)} ${migration.name}`);
    });
    ui.line();

    const confirmed = await requireConfirmation({
      message: `Apply ${plural(pending.length, "migration")}?`,
      prompter,
      ui,
      yes: options.yes === true,
    });
    if (!confirmed) {
      ui.note("Cancelled - nothing was applied.");
      ui.line();

      return EXIT_CODE.ok;
    }

    await ui.runTask("Applying migrations", async () =>
      withQuietOutput(ui.verbose, async () =>
        handle.apply(message => {
          ui.note(message);
        }),
      ),
    );
    pending.forEach(migration => {
      ui.success(migration.name);
    });
    ui.line();
    ui.success("Database is up to date.");
    ui.line();

    return EXIT_CODE.ok;
  } finally {
    await handle.close();
  }
};

export const runDbPushCommand = async (
  context: CommandContext,
  options: DbOptions,
  { services: create }: { services?: Services } = {},
): Promise<number> => {
  const { env, prompter, ui } = context;
  ui.header("Push database schema");

  ui.warning("Direct schema synchronization is intended for development.");
  ui.note(
    `In production, use migrations: ${ui.colors.command("vitnode db generate")} and ${ui.colors.command("vitnode db migrate")}.`,
  );
  ui.line();

  if (env.NODE_ENV === "production" && options.force !== true) {
    throw new UserError(
      "Refusing to push the schema: NODE_ENV is production.",
      {
        hint: "Generate and apply a migration instead. If you really mean to push to this database, pass --force.",
      },
    );
  }

  const { services } = servicesFor(context, create);
  let planned = await ui.runTask(
    "Comparing schema with the database",
    async () => explain(services, ["push", "--explain", "--output", "json"]),
  );

  const unresolved =
    planned.status === "missing_hints" ? planned.unresolved : [];
  const renames = unresolved.filter(hint => !isDataLossHint(hint));
  const dataLoss = unresolved.filter(isDataLossHint);

  if (renames.length > 0) {
    ui.section("Changes need a decision");
    renderHints(ui, unresolved);

    if (!ui.interactive) {
      throw new UserError("drizzle-kit has to ask whether these are renames.", {
        hint: "Run vitnode db push in an interactive terminal and answer its questions.",
      });
    }
    ui.line();
    const { code } = await services.drizzleKit(["push"], { capture: false });

    return code === 0 ? EXIT_CODE.ok : EXIT_CODE.failure;
  }

  // Data loss is confirmed here, once, by name - then handed to drizzle-kit as
  // explicit hints, never as a blanket --force.
  const hints = dataLoss.map(hint => ({
    entity: hint.entity,
    kind: hint.kind,
    type: "confirm_data_loss",
  }));
  const hintArgs = hints.length === 0 ? [] : ["--hints", JSON.stringify(hints)];

  if (hints.length > 0) {
    planned = await explain(services, [
      "push",
      "--explain",
      "--output",
      "json",
      ...hintArgs,
    ]);

    if (planned.status === "missing_hints") {
      throw new RuntimeError(
        "drizzle-kit still needs decisions VitNode cannot make for you.",
        {
          details: planned.unresolved.map(
            hint =>
              `${hint.type}: ${hint.kind ?? "entity"} ${formatHintEntity(hint.entity)}`,
          ),
          hint: "Run vitnode db push in an interactive terminal.",
        },
      );
    }
  }

  const statements = planned.status === "ok" ? (planned.statements ?? []) : [];
  if (statements.length === 0) {
    ui.success("Schema is already in sync.");
    ui.line();

    return EXIT_CODE.ok;
  }

  ui.section("Changes");
  renderStatements(ui, statements);

  if (dataLoss.length > 0) {
    ui.section(ui.colors.error("Data loss"));
    renderHints(ui, dataLoss);

    if (!ui.interactive && options.acceptDataLoss !== true) {
      ui.line();
      throw new UserError("These changes delete data.", {
        hint: "Pass --accept-data-loss (with --yes) to apply them from a script.",
      });
    }
  }
  ui.line();

  const confirmed =
    dataLoss.length > 0 && options.acceptDataLoss !== true && ui.interactive
      ? await prompter.confirm(
          `Apply ${plural(statements.length, "change")}, including ${plural(dataLoss.length, "that deletes", "that delete")} data?`,
          { default: false },
        )
      : await requireConfirmation({
          message: `Apply ${plural(statements.length, "change")}?`,
          prompter,
          ui,
          yes: options.yes === true,
        });

  if (!confirmed) {
    ui.note("Cancelled - nothing was changed.");
    ui.line();

    return EXIT_CODE.ok;
  }

  await ui.runTask("Pushing schema", async () =>
    explain(services, ["push", "--output", "json", ...hintArgs]),
  );
  ui.success("Schema pushed.");
  ui.line();

  return EXIT_CODE.ok;
};

export const runDbStatusCommand = async (
  context: CommandContext,
  _options: DbOptions,
  { services: create }: { services?: Services } = {},
): Promise<number> => {
  const { ui } = context;
  ui.header("Database");

  const { services } = servicesFor(context, create);
  const config = await services.drizzleConfig();
  const local = await services.readLocalMigrations(config.migrationsFolder);
  const provider =
    config.dialect === null
      ? "unknown"
      : (PROVIDER_NAMES[config.dialect] ?? config.dialect);

  let handle: DatabaseHandle;
  const connecting = ui.task("Connecting to the database");
  try {
    handle = await services.open(config);
    await handle.ping();
    connecting.skip();
  } catch (error) {
    connecting.skip();
    ui.keyValue([
      ["Provider", provider],
      ["Status", ui.colors.error(`${ui.symbols.pending} unreachable`)],
      ["Migrations", `${String(local.length)} on disk`],
    ]);
    throw new RuntimeError("Could not connect to the database.", {
      cause: error,
      details: [rootCauseMessage(error)],
      hint: "Is it running? In development, pnpm docker:dev starts one.",
    });
  }

  try {
    const journal = await readJournal(handle.query, {
      schema: config.migrationsSchema,
      table: config.migrationsTable,
    });
    const state = computeMigrationState(local, journal);

    ui.keyValue([
      ["Provider", provider],
      ...(handle.location === null
        ? []
        : [["Database", handle.location] as const]),
      ["Status", ui.colors.success(`${ui.symbols.dot} connected`)],
    ]);

    ui.section("Migrations");
    ui.keyValue([
      ["Applied", String(state.applied.length)],
      [
        "Pending",
        state.pending.length === 0
          ? "0"
          : ui.colors.warning(String(state.pending.length)),
      ],
    ]);

    if (state.pending.length > 0) {
      ui.section("Pending");
      state.pending.forEach(migration => {
        ui.line(`  ${ui.colors.muted(ui.symbols.pending)} ${migration.name}`);
      });
      ui.line();
      ui.note(`Apply them with ${ui.colors.command("vitnode db migrate")}.`);
    }

    if (state.modified.length > 0) {
      ui.line();
      ui.warning(
        `${plural(state.modified.length, "applied migration")} changed on disk since it was applied: ${state.modified.join(", ")}`,
      );
    }
    if (state.missingLocally.length > 0) {
      ui.line();
      ui.warning(
        `${plural(state.missingLocally.length, "applied migration")} missing from ${config.migrationsFolder}: ${state.missingLocally.join(", ")}`,
      );
    }
    ui.line();

    return EXIT_CODE.ok;
  } finally {
    await handle.close();
  }
};
