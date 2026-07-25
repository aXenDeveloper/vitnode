import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";

config({
  quiet: true,
});

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    casing: "camelCase",
  }),
  // Redis is opt-in: only enabled when REDIS_URL is set. Without it the cache
  // is a no-op, the rate limiter uses in-memory storage, and WebSockets run in
  // single-instance mode.
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
  metadata: {
    title: "VitNode API",
    shortTitle: "VitNode",
  },
});
