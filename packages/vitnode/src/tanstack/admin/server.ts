import { manifest } from "@/manifest";
import "@tanstack/react-start/server-only";

import { fetcher } from "@/tanstack/fetcher/server";

import { readAdminSessionThrough } from "./session-read";

export const readAdminSessionOnApi = async () =>
  await readAdminSessionThrough(async () => {
    const response = await fetcher({
      plugin: manifest.id,
      method: "get",
      module: "admin",
      path: "/session",
      args: { query: {} },
    });

    // See `default-transport`: the `200` arm is the only one with a body, and
    // narrowing to it at the call site is what keeps the payload typed.
    return {
      session: response.status === 200 ? await response.json() : undefined,
      status: response.status,
    };
  });

export { readAdminUserSearch as readAdminUserSearchOnApi } from "./user-search";
