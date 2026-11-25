import { buildModule } from "@/builders";

import {
  approveMcpAuthorizeRoute,
  showMcpAuthorizeRoute,
} from "./routes/authorize.route";
import {
  listMcpConnectionsRoute,
  revokeMcpConnectionRoute,
} from "./routes/connections.route";

/**
 * The member side of MCP: the consent page's checks and answer, and the list
 * of connected clients. The protocol endpoint and its OAuth server live at
 * `/api/mcp` (`lib/mcp`).
 */
export const mcpModule = buildModule({
  name: "mcp",
  routes: [
    showMcpAuthorizeRoute,
    approveMcpAuthorizeRoute,
    listMcpConnectionsRoute,
    revokeMcpConnectionRoute,
  ],
});
