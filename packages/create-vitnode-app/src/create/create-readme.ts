import type { CreateCliReturn } from "../questions.js";

import { packageManagerCommands } from "../helpers/package-manager-commands.js";

/** The apps a generated project has, as directories relative to its root. */
const envFiles = ({
  mode,
  workspace,
}: {
  mode: CreateCliReturn["mode"];
  workspace: boolean;
}): string[] => {
  if (!workspace) return ["."];
  if (mode === "onlyApi") return ["apps/api"];
  if (mode === "singleApp") return ["apps/web"];

  return ["apps/api", "apps/web"];
};

/**
 * The scripts worth a row in the README, and what each one is for.
 *
 * Rendered only when the project actually has the script: a bun API compiles
 * nothing, so it has no `build`, and a table row naming a command that exits 1
 * is worse than no row.
 */
const DOCUMENTED: [script: string, what: string][] = [
  ["dev", "Prepare the database, then start the development server."],
  ["db:migrate", "The same database work on its own. Run it in deployment."],
  ["docker:dev", "Start the bundled Postgres and Redis."],
  ["build", "Build for production."],
  ["start", "Run the production build. Never migrates."],
  ["lint", "Lint every package."],
];

const START_URLS = {
  apiMonorepo:
    "[http://localhost:3000](http://localhost:3000) for the Web app and [http://localhost:8000](http://localhost:8000) for the API",
  onlyApi: "[http://localhost:8000](http://localhost:8000)",
  singleApp: "[http://localhost:3000](http://localhost:3000)",
};

/**
 * The generated README, filled in for one project.
 *
 * Pure - it takes the committed template and returns the text - so what a new
 * project is told to run can be asserted without generating one. That matters
 * because the README is the only place the first-start sequence is written down
 * for a human, and it is trivially wrong in ways nothing else catches: the
 * commands used to be produced by replacing `pnpm` with the chosen manager,
 * which spells `npm dev` for a command npm does not have.
 */
export const renderReadme = ({
  appName,
  docker,
  mode,
  packageManager,
  scripts,
  template,
  workspace,
}: {
  appName: string;
  docker: boolean;
  mode: CreateCliReturn["mode"];
  packageManager: string;
  /** The scripts of the package at the project root - see `projectRootScripts`. */
  scripts: Record<string, string>;
  template: string;
  workspace: boolean;
}): string => {
  const pm = packageManagerCommands(packageManager);
  const envCopy = envFiles({ mode, workspace })
    .map(app =>
      app === "."
        ? "cp .env.example .env"
        : `cp ${app}/.env.example ${app}/.env`,
    )
    .join("\n");

  const replacements: Record<string, string> = {
    "{{DATABASE}}": docker
      ? `This project ships one — start it with \`${pm.run("docker:dev")}\`, and the values in \`.env.example\` already point at it.`
      : `Point \`POSTGRES_URL\` in each \`.env\` at yours, then create an empty \`${appName}\` database for VitNode to migrate.`,
    "{{DEV}}": pm.run("dev"),
    "{{ENV_COPY}}": envCopy,
    "{{INSTALL}}": pm.install,
    "{{COMMANDS}}": DOCUMENTED.filter(([script]) => script in scripts)
      .map(([script, what]) => `| \`${pm.run(script)}\` | ${what} |`)
      .join("\n"),
    "{{START_URLS}}": START_URLS[mode],
  };

  return Object.entries(replacements).reduce(
    (readme, [token, value]) => readme.replaceAll(token, value),
    template,
  );
};
