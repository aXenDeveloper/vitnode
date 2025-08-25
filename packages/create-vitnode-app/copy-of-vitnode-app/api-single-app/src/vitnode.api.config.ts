import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { drizzle } from "drizzle-orm/postgres-js";

export const POSTGRES_URL =
  process.env.POSTGRES_URL || "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  pathToMessages: async path => await import(`./locales/${path}`),
  metadata: {
    title: "VitNode",
    shortTitle: "VitNode",
  },
  plugins: [],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: "camelCase",
  }),
});
