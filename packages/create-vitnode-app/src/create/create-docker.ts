import { writeFile } from "fs/promises";
import { join } from "path";

import type { CreateCliReturn } from "../questions.js";

import { runtimeOf } from "./create-package-json.js";

type Mode = CreateCliReturn["mode"];
type Runtime = "bun" | "node";

const NODE_IMAGE = "node:24-slim";
const BUN_IMAGE = "oven/bun:1";
const BUN_RUNTIME_IMAGE = "oven/bun:1-slim";

interface DockerLayout {
  /** A standalone API, if the project has one. */
  api?: { dir: string };
  /** The TanStack Start app that serves the site, if the project has one. */
  app?: { dir: string; embedsApi: boolean };
  /** The package that owns the schema and runs `db:migrate`. */
  db: string;
}

export const dockerLayout = (mode: Mode, monorepo: boolean): DockerLayout => {
  if (mode === "singleApp") {
    const dir = monorepo ? "apps/web" : ".";

    return { app: { dir, embedsApi: true }, db: dir };
  }
  if (mode === "onlyApi") {
    const dir = monorepo ? "apps/api" : ".";

    return { api: { dir }, db: dir };
  }

  return {
    api: { dir: "apps/api" },
    app: { dir: "apps/web", embedsApi: false },
    db: "apps/api",
  };
};

const installCommand = (pm: string): string => {
  if (pm === "npm") return "npm ci";
  if (pm === "bun") return "bun install --frozen-lockfile";

  return "pnpm install --frozen-lockfile";
};

/**
 * A clean install without devDependencies over the built workspace, so what
 * the build compiled (`dist`, plugins) stays and the dev tooling goes. Every
 * `node_modules` is removed first: an install over a dev one leaves the dev
 * packages behind in pnpm's store folder.
 */
const prodInstallCommand = (pm: string): string => {
  const clean =
    "find . -name node_modules -type d -prune -exec rm -rf {} + && ";
  if (pm === "npm") return "npm ci --omit=dev";
  if (pm === "bun") return `${clean}bun install --production --frozen-lockfile`;

  return `${clean}pnpm install --prod --frozen-lockfile`;
};

const storeCache = (pm: string): string => {
  if (pm === "npm") return "/root/.npm";
  if (pm === "bun") return "/root/.bun/install/cache";

  return "/root/.local/share/pnpm/store";
};

/** Where local file storage keeps uploads, relative to the server's folder. */
const UPLOADS = "public/uploads";

/** The folder uploads land in inside the image that serves the API. */
const uploadsPath = (layout: DockerLayout): string =>
  layout.api ? `${workdir(layout.api.dir)}/${UPLOADS}` : `/app/${UPLOADS}`;

const workdir = (dir: string): string => (dir === "." ? "/app" : `/app/${dir}`);

/**
 * A `HEALTHCHECK` that needs nothing but the runtime itself - slim images ship
 * no curl. An app or API asks `/api/health`; a web app without an embedded API
 * has no such route, so only its port is checked.
 */
const healthcheck = (runtime: Runtime, port: number, http: boolean): string => {
  const target = `process.env.PORT||${String(port)}`;
  const script = http
    ? `fetch('http://127.0.0.1:'+(${target})+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))`
    : `require('node:net').connect(${target},'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))`;

  return `HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \\
  CMD ["${runtime}", "-e", "${script}"]`;
};

/**
 * The production `Dockerfile`: one `build` stage for the whole workspace, a
 * `migrate` target that applies migrations once per deploy, and one small
 * runtime target per server (`app`, `api`).
 */
export const dockerfile = ({
  appName,
  layout,
  packageManager: pm,
  pmVersion,
  runtime,
}: {
  appName: string;
  layout: DockerLayout;
  packageManager: string;
  pmVersion: string | undefined;
  runtime: Runtime;
}): string => {
  const needsBun = pm === "bun" || runtime === "bun";
  // A Bun API has no build: Bun runs `src/index.ts` as it is.
  const hasBuild = !(
    runtime === "bun" &&
    !layout.app &&
    layout.api?.dir === "."
  );
  const runtimeImage = runtime === "bun" ? BUN_RUNTIME_IMAGE : NODE_IMAGE;
  // Both runtime images name their unprivileged user after the binary.
  const user = runtime;

  const lines: string[] = [
    "# syntax=docker/dockerfile:1",
    "",
    "# Production image. Build one target per server:",
    ...(layout.app
      ? [`#   docker build --target app -t ${appName}-app .`]
      : []),
    ...(layout.api
      ? [`#   docker build --target api -t ${appName}-api .`]
      : []),
    "# and run `--target migrate` once per deploy, before the new version starts.",
    "# docker-compose.prod.yml does all of it.",
    "",
    `FROM ${NODE_IMAGE} AS build`,
    "WORKDIR /app",
  ];

  if (needsBun) {
    lines.push(
      `COPY --from=${BUN_IMAGE} /usr/local/bin/bun /usr/local/bin/bun`,
    );
  }
  if (pm === "pnpm") {
    if (pmVersion === undefined) {
      throw new Error(
        "Install pnpm before generating a pnpm project with Docker: the image pins the pnpm version you have.",
      );
    }
    lines.push(`RUN npm install -g pnpm@${pmVersion}`);
  }
  lines.push(
    "",
    "COPY . .",
    `RUN --mount=type=cache,target=${storeCache(pm)} ${installCommand(pm)}`,
  );

  if (layout.app && !layout.app.embedsApi) {
    lines.push(
      "",
      "# The web app calls the API at this URL from the server and from the",
      "# browser, so it is compiled in: the API's public address.",
      "ARG VITNODE_API_URL",
      "ENV VITNODE_API_URL=$VITNODE_API_URL",
    );
  }
  if (hasBuild) {
    lines.push("", "ENV NODE_ENV=production", `RUN ${pm} run build`);
  }

  lines.push(
    "",
    "# Applies pending migrations and seeds what VitNode needs, then exits.",
    "FROM build AS migrate",
    `WORKDIR ${workdir(layout.db)}`,
    "ENV NODE_ENV=production",
    `CMD ["${pm}", "run", "db:migrate"]`,
  );

  if (layout.app) {
    lines.push(
      "",
      "# The site: Nitro's server bundle, with no node_modules beside it.",
      `FROM ${runtimeImage} AS app`,
      "WORKDIR /app",
      "ENV NODE_ENV=production PORT=3000",
      `COPY --from=build --chown=${user}:${user} ${workdir(layout.app.dir)}/.output ./.output`,
      ...(layout.app.embedsApi
        ? [
            "# Local file storage writes here; compose mounts a volume on it.",
            `RUN mkdir -p ${UPLOADS} && chown -R ${user}:${user} public`,
          ]
        : []),
      `USER ${user}`,
      "EXPOSE 3000",
      healthcheck(runtime, 3000, layout.app.embedsApi),
      `CMD ["${runtime}", ".output/server/index.mjs"]`,
    );
  }

  if (layout.api) {
    const entry = runtime === "bun" ? "src/index.ts" : "dist/index.js";
    lines.push(
      "",
      "# The build without devDependencies: what the API needs at runtime.",
      "FROM build AS api-deps",
      `RUN --mount=type=cache,target=${storeCache(pm)} ${prodInstallCommand(pm)}`,
      "",
      "# The API runs from the workspace with its production packages.",
      `FROM ${runtimeImage} AS api`,
      `COPY --from=api-deps --chown=${user}:${user} /app /app`,
      `WORKDIR ${workdir(layout.api.dir)}`,
      `RUN mkdir -p ${UPLOADS} && chown ${user}:${user} public ${UPLOADS}`,
      "ENV NODE_ENV=production PORT=8000",
      `USER ${user}`,
      "EXPOSE 8000",
      healthcheck(runtime, 8000, true),
      `CMD ["${runtime}", "${entry}"]`,
    );
  }

  return `${lines.join("\n")}\n`;
};

/** Keeps secrets, local data and anything the build regenerates out of the image. */
export const DOCKERIGNORE = `# Never send secrets or local data to the build
.env
.env.*
!.env.example
docker/dev

# Rebuilt inside the image
**/node_modules
**/.output
**/.nitro
**/.vite
**/.tanstack
**/.turbo
**/dist
**/*.tsbuildinfo

# Not needed to build
.git
.vscode
**/*.log
Dockerfile
docker-compose*.yml
`;

/**
 * `docker-compose.prod.yml`: PostgreSQL and Redis on a private network, the
 * migration job, and the server(s), which start only once migrations
 * succeeded. Every secret comes from an env file, never from this file.
 */
export const dockerComposeProd = ({
  appName,
  layout,
}: {
  appName: string;
  layout: DockerLayout;
}): string => {
  const split = layout.app !== undefined && !layout.app.embedsApi;
  // Every target builds FROM the same stage: the same args share one build.
  const build = (target: string): string =>
    `    build:
      context: .
      target: ${target}${
        split
          ? `
      args:
        VITNODE_API_URL: \${VITNODE_API_URL:?Set VITNODE_API_URL to the API's public origin}`
          : ""
      }`;
  const ready = `    depends_on:
      migrate:
        condition: service_completed_successfully
      cache:
        condition: service_started`;

  const services: string[] = [
    `  database:
    image: postgres:17.5-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-vitnode}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB:-vitnode}
    volumes:
      - database:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $\${POSTGRES_USER} -d $\${POSTGRES_DB}']
      interval: 5s
      timeout: 5s
      retries: 10`,
    `  cache:
    image: redis:8.8-alpine
    restart: unless-stopped
    command: redis-server --requirepass \${REDIS_PASSWORD:?Set REDIS_PASSWORD}`,
    `  # Runs once per \`up\`, then exits; the servers wait for it.
  migrate:
${build("migrate")}
    environment: *server-env
    depends_on:
      database:
        condition: service_healthy`,
  ];

  if (layout.api) {
    services.push(`  api:
${build("api")}
    image: ${appName}-api
    restart: unless-stopped
    environment: *server-env
    ports:
      - '\${API_PORT:-8000}:8000'
    volumes:
      - uploads:${uploadsPath(layout)}
${ready}`);
  }

  if (layout.app) {
    services.push(`  app:
${build("app")}
    image: ${appName}-app
    restart: unless-stopped
    environment:${
      split
        ? `
      # The web app reaches the database only through the API.
      VITNODE_WEB_URL: \${VITNODE_WEB_URL:?Set VITNODE_WEB_URL to the site's public origin}
      VITNODE_API_URL: \${VITNODE_API_URL:?Set VITNODE_API_URL to the API's public origin}`
        : " *server-env"
    }
    ports:
      - '\${APP_PORT:-3000}:3000'${
        split
          ? ""
          : `
    volumes:
      - uploads:${uploadsPath(layout)}`
      }
${
  split
    ? `    depends_on:
      api:
        condition: service_healthy`
    : ready
}`);
  }

  return `# Production stack. Put the variables below in .env.production, then:
#   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# PostgreSQL and Redis are not published; only the server ports are.
name: ${appName}

x-server-env: &server-env
  POSTGRES_URL: postgresql://\${POSTGRES_USER:-vitnode}:\${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}@database:5432/\${POSTGRES_DB:-vitnode}
  REDIS_URL: redis://cache:6379
  REDIS_PASSWORD: \${REDIS_PASSWORD:?Set REDIS_PASSWORD}
  VITNODE_WEB_URL: \${VITNODE_WEB_URL:?Set VITNODE_WEB_URL to the site's public origin}
  CRON_SECRET: \${CRON_SECRET:?Set CRON_SECRET to a long random string}
  # 0 when visitors reach the container directly, 1 behind one reverse proxy.
  VITNODE_TRUSTED_PROXY_HOPS: \${VITNODE_TRUSTED_PROXY_HOPS:-0}

services:
${services.join("\n\n")}

volumes:
  database:
  # Local file storage. Not needed once uploads go to S3, R2 or Supabase.
  uploads:
`;
};

/** Writes the production Docker files into the project root. */
export const createDockerFiles = async ({
  appName,
  deploy,
  mode,
  monorepo,
  packageManager,
  pmVersion,
  root,
}: Pick<CreateCliReturn, "deploy" | "mode" | "packageManager"> & {
  appName: string;
  monorepo: boolean;
  pmVersion: string | undefined;
  root: string;
}): Promise<void> => {
  const layout = dockerLayout(mode, monorepo);
  await Promise.all([
    writeFile(
      join(root, "Dockerfile"),
      dockerfile({
        appName,
        layout,
        packageManager,
        pmVersion,
        runtime: runtimeOf(deploy),
      }),
    ),
    writeFile(join(root, ".dockerignore"), DOCKERIGNORE),
    writeFile(
      join(root, "docker-compose.prod.yml"),
      dockerComposeProd({ appName, layout }),
    ),
  ]);
};
