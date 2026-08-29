/**
 * The realtime layer of a TanStack Start application shell.
 *
 * The WebSocket *provider* is not here - it is framework-free and lives in
 * `@vitnode/core/ws/provider`, mounted once by the host's root. What this
 * namespace owns is the pair of listeners that hang off that one connection and
 * the derivation that keeps it authenticated as the right visitor.
 */

export { RealtimeListeners } from "./realtime-listeners";
export type { SocketSession } from "./session";
export { socketUserIdFromSession } from "./session";
