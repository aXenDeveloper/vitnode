import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { apiBridge } from "@/server/vitnode-api.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        ANY: async ({ request }) =>
          apiBridge(request, { clientAddress: getRequestIP() }),
      }),
  },
});
