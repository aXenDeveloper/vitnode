import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";
import { MCP_SCOPES } from "../lib/mcp/scopes";

const pluginId = manifest.id;

/** Why an MCP connection ended. */
export const MCP_CONNECTION_REVOKE_REASONS = [
  // The member disconnected the client.
  "user",
  // The member's password changed (their own reset, or an admin set it).
  "password_changed",
  // Every session of the account was ended: an admin signed it out
  // everywhere, or its deletion was requested.
  "sessions_revoked",
  // The member approved the same client again; the new connection replaces it.
  "replaced",
  // A rotated refresh token was presented again - a copy leaked.
  "refresh_reuse",
  // An authorization code was presented a second time - a copy leaked.
  "code_reuse",
  // The client revoked its refresh token (RFC 7009).
  "token_revoked",
] as const;

export type McpConnectionRevokeReason =
  (typeof MCP_CONNECTION_REVOKE_REASONS)[number];

/**
 * A member approved an MCP client and it exchanged its code: the connection
 * exists and holds its first tokens.
 */
export const mcpConnectionCreatedEvent = defineEvent({
  pluginId,
  name: "mcp.connection.created",
  payload: z.object({
    clientId: z.string(),
    clientName: z.string(),
    scopes: z.array(z.enum(MCP_SCOPES)),
    userId: z.number().int(),
  }),
});

/** An MCP connection was revoked; its tokens stopped working. */
export const mcpConnectionRevokedEvent = defineEvent({
  pluginId,
  name: "mcp.connection.revoked",
  payload: z.object({
    clientId: z.string(),
    reason: z.enum(MCP_CONNECTION_REVOKE_REASONS),
    userId: z.number().int(),
  }),
});

/** Every `mcp.*` event core defines. */
export const mcpEventDefinitions = [
  mcpConnectionCreatedEvent,
  mcpConnectionRevokedEvent,
];
