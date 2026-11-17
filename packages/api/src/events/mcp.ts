import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

/** A member created an MCP token. Never carries the token itself. */
export const mcpTokenCreatedEvent = defineEvent({
  pluginId,
  name: "mcp.token.created",
  payload: z.object({
    expiresAt: z.string(),
    tokenId: z.number().int(),
    tools: z.array(z.string()),
    userId: z.number().int(),
  }),
});

/** A member revoked one of their MCP tokens; it stops working at once. */
export const mcpTokenRevokedEvent = defineEvent({
  pluginId,
  name: "mcp.token.revoked",
  payload: z.object({
    tokenId: z.number().int(),
    userId: z.number().int(),
  }),
});

export const mcpEventDefinitions = [
  mcpTokenCreatedEvent,
  mcpTokenRevokedEvent,
] as const;
