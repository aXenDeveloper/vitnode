import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * What a generated app is, as far as its environment is concerned.
 *
 * Three, because there are three answers to "does this process talk to
 * Postgres": the single app serves its own `/api/*` and does, a standalone API
 * does, and the frontend of a split deployment talks to that API over HTTP and
 * must not be handed database credentials it has no use for.
 */
export type EnvRole = "api" | "singleApp" | "web";

const DOCKER = `
# === Docker Database Postgres ===
POSTGRES_USER=root
POSTGRES_PASSWORD=root
POSTGRES_NAME=vitnode

# === Docker Redis ===
REDIS_PASSWORD=root
`;

/**
 * A `.env.example` for one app.
 *
 * Composed rather than copied, because the three roles above genuinely differ
 * and the same file cannot serve them: a single app's URLs both name its own
 * origin, a split API's do not, and a split frontend has no `POSTGRES_URL` at
 * all. Three template files covering that would be three files that have to
 * agree - and the shape most of them land in is the *same destination* as
 * another tree's copy, which is a race rather than an overlay.
 *
 * Pure, so the environment every shape starts with can be asserted without
 * running the generator.
 */
export const envExample = ({
  docker = false,
  role,
}: {
  docker?: boolean;
  role: EnvRole;
}): string => {
  if (role === "web") {
    return `# The API this frontend talks to. It owns the database; this app has no
# credentials of its own and never migrates anything.
NEXT_PUBLIC_API_URL=http://localhost:8000

# This app's own origin, so absolute links and SSO callbacks resolve. Optional in
# development: in the browser it falls back to the origin the page was served
# from, which is what makes a preview deployment on a generated hostname work
# with no configuration at all.
NEXT_PUBLIC_WEB_URL=http://localhost:3000
`;
  }

  const apiUrl =
    role === "singleApp" ? "http://localhost:3000" : "http://localhost:8000";
  const urls =
    role === "singleApp"
      ? `# Both name this app's own origin, because it serves its own \`/api/*\` - and it
# has to be the port \`dev\` actually serves. Neither is strictly required: on the
# server the API origin is taken off the request being rendered, and in the
# browser it falls back to the origin the page was served from. Set
# \`NEXT_PUBLIC_API_URL\` only to point at a separate API server;
# \`NEXT_PUBLIC_WEB_URL\` is what the API stamps cookies with.`
      : `# \`NEXT_PUBLIC_WEB_URL\` is the frontend's origin, which is what this API stamps
# cookies with and what SSO callbacks are built from.`;

  return `POSTGRES_URL=postgresql://root:root@localhost:5432/vitnode

# Optional. Set it and the cache, the rate limiter and WebSockets become
# multi-instance; leave it unset and the cache is a no-op and they run in memory.
REDIS_URL=redis://localhost:6379

${urls}
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=${apiUrl}

# === CRON Secret for Internal API Calls ===
CRON_SECRET=your-secure-cron-secret-key
${docker ? DOCKER : ""}`;
};

/** Writes the `.env.example` an app of this role starts from. */
export const writeEnvExample = async ({
  docker,
  root,
  role,
}: {
  docker?: boolean;
  role: EnvRole;
  root: string;
}): Promise<void> => {
  await writeFile(join(root, ".env.example"), envExample({ docker, role }));
};
