import { scopedDatabase } from "@vitnode/core/cloudflare/database";
import { coreRelations } from "@vitnode/core/database/relations";
import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { drizzle } from "drizzle-orm/postgres-js";

import { contentModules } from "./content-modules.gen";
import { frontendPlugins } from "./plugin-inventory.gen";
import { vitNodeConfig } from "./vitnode.config";

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  metadata: {
    title: "VitNode",
    shortTitle: "VitNode",
  },
  plugins: [],
  contentModules,
  frontendPlugins,
  i18n: vitNodeConfig.i18n,
  // A Cloudflare Worker request cannot reuse a connection another request
  // opened, so the client is created per request - and per busy period of the
  // realtime hub, which closes it when idle so it can hibernate. On Node
  // (`dev`, migrations) it is one client per process.
  dbProvider: scopedDatabase(() =>
    drizzle({
      connection: {
        url: POSTGRES_URL,
        max: 1,
        onnotice: () => undefined,
      },
      relations: coreRelations,
    }),
  ),
  // No `redis`: on Cloudflare the realtime hub owns every socket, so there is
  // nothing to relay, and the cache falls back to each isolate's memory.
});
