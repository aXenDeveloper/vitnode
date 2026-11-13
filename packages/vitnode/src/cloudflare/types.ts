/**
 * Structural types for the Workers runtime objects VitNode touches, so the
 * Node-safe modules of the Cloudflare integration need no
 * `@cloudflare/workers-types` and import nothing from `cloudflare:workers`.
 */

/** A Durable Object id. */
export interface CloudflareDurableObjectId {
  toString: () => string;
}

/** The RPC surface of the realtime hub, as the Worker sees it through a stub. */
export interface VitNodeRealtimeHubStub {
  /** Applies one command; see `VitNodeHubCommand`. */
  dispatch: (command: unknown) => Promise<unknown>;
  fetch: (request: Request) => Promise<Response>;
}

/** The Durable Object namespace binding of the realtime hub. */
export interface VitNodeRealtimeHubNamespace {
  get: (id: CloudflareDurableObjectId) => VitNodeRealtimeHubStub;
  idFromName: (name: string) => CloudflareDurableObjectId;
}

/** The parts of a Worker's `ExecutionContext` VitNode uses. */
export interface CloudflareExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

/** A Worker's bindings, as VitNode reads them. */
export type CloudflareEnv = Record<string, unknown>;

/** The server end of a `WebSocketPair`, with the Workers-only `accept()`. */
export interface CloudflareServerWebSocket {
  accept: () => void;
  addEventListener: ((
    type: "message",
    listener: (event: { data: ArrayBuffer | string }) => void,
  ) => void) &
    ((
      type: "close",
      listener: (event: { code: number; reason: string }) => void,
    ) => void) &
    ((type: "error", listener: (event: { error?: unknown }) => void) => void);
  close: (code?: number, reason?: string) => void;
  /** Hibernation API: the value stored with {@link serializeAttachment}. */
  deserializeAttachment: () => unknown;
  readonly protocol?: null | string;
  readonly readyState: number;
  send: (data: ArrayBuffer | string | Uint8Array) => void;
  /**
   * Hibernation API: keeps up to 2 KiB of JSON with the socket, readable after
   * the hub wakes from hibernation.
   */
  serializeAttachment: (value: unknown) => void;
}
