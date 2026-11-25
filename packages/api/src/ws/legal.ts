import { manifest } from "@/manifest";

import { createWebSocketChannel } from "./types";

/**
 * Pushed to every connected tab when a legal document version takes effect,
 * so open sessions refetch their legal state (and a member who now owes Terms
 * acceptance is routed to the acceptance page). Browser-safe.
 */
export const legalChangesChannel = createWebSocketChannel<
  never,
  { versionId: number }
>({
  id: "changes",
  module: "legal",
  pluginId: manifest.id,
});
