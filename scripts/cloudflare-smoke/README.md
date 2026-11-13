# Cloudflare realtime smoke test

`smoke.mjs` drives VitNode realtime end to end against a running Cloudflare
Worker (local `wrangler dev` or a deployment): every push starts as an ordinary
HTTP request, and the sockets live in the Durable Object hub. It checks all five
realtime methods, rooms, the handshake policy (Origin, rate limit, client IP),
session revocation, reconnects, two-editor Content Engine live editing, and -
with `SMOKE_HIBERNATION_WAIT=80` - that a hibernated hub wakes with its sockets,
rooms and sessions intact.

`realtime-demo.ts` is the app-side half: an admin-only push endpoint and a demo
room the script talks to. Neither file is part of any package.

## Run it

1. Generate a Single App with the Cloudflare target inside this repository, so
   it links the local packages:

   ```bash
   node packages/create-vitnode-app/dist/src/index.js apps/cf-smoke \
     --mode singleApp --deploy cloudflare --package-manager pnpm --skip-git
   ```

   In `apps/cf-smoke/package.json` set `@vitnode/core` and `@vitnode/config`
   to `workspace:*`, and add `@vitnode/blog: workspace:*`, `postgres`, and the
   dev dependencies `ws` and `yjs`.

2. Register the blog plugin (`blogPlugin()` in `src/vitnode.config.ts`,
   `blogApiPlugin()` in `src/vitnode.api.config.ts`), copy
   `realtime-demo.ts` to `src/server/`, and in `src/server/vitnode-api.server.ts`
   pass `realtimeDemoEvents` to `handleVitNodeWebSocket(...)` and call
   `mountRealtimeDemo(app)` after the `/ws` route.

3. Copy `.env.example` to `.env` and `.dev.vars.example` to `.dev.vars`, point
   both at an empty PostgreSQL database, then:

   ```bash
   pnpm install
   cd apps/cf-smoke
   pnpm db:prepare && pnpm build && pnpm preview --ip 0.0.0.0
   ```

4. In another terminal, from `apps/cf-smoke` (so `postgres`, `ws` and `yjs`
   resolve):

   ```bash
   SMOKE_URL=http://<non-loopback-ip>:8787 node ../../scripts/cloudflare-smoke/smoke.mjs
   ```

   A non-loopback address makes the client-IP check meaningful. Add
   `SMOKE_HIBERNATION_WAIT=80` for the hibernation round, and run
   `pnpm preview --var VITNODE_REALTIME_SHARDS:3` to test three shards. The
   first account the script creates becomes the root admin, so start from an
   empty database. The burst at the end spends the IP's rate-limit budget for a
   minute.

Delete `apps/cf-smoke` afterwards; it is not meant to be committed.
