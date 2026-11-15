import type { manifest } from "@vitnode/api/manifest";

import type { ResponseFor } from "@/lib/fetcher/types";

type JsonBodyOf<R> = R extends { json: () => Promise<infer T> } ? T : never;

export type SessionApi = JsonBodyOf<
  ResponseFor<typeof manifest.id, "users", "/session", "get">
>;
