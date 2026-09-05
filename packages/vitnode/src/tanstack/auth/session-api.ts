import type { readSessionOnApi } from "./server";

export type SessionApi = Awaited<ReturnType<typeof readSessionOnApi>>;
