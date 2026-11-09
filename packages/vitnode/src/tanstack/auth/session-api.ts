import type { ResponseFor } from "@/lib/fetcher/types";
import type { manifest } from "@/manifest";

type JsonBodyOf<R> = R extends { json: () => Promise<infer T> } ? T : never;

export type SessionApi = JsonBodyOf<
  ResponseFor<typeof manifest.id, "users", "/session", "get">
>;
