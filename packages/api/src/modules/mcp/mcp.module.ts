import { buildModule } from "@/builders";

import { createMcpTokenRoute } from "./routes/create-token.route";
import { listMcpTokensRoute } from "./routes/list-tokens.route";
import { listMcpToolsRoute } from "./routes/list-tools.route";
import { revokeMcpTokenRoute } from "./routes/revoke-token.route";

/**
 * A member's own MCP tokens, at `/api/@vitnode/core/mcp`: the tools they may
 * grant, their tokens, and creating and revoking one. The MCP endpoint itself
 * is mounted by `VitNodeAPI` at `/api/mcp`.
 */
export const mcpModule = buildModule({
  name: "mcp",
  routes: [
    listMcpToolsRoute,
    listMcpTokensRoute,
    createMcpTokenRoute,
    revokeMcpTokenRoute,
  ],
});
