// The parts of the Workers runtime module the hub uses. Kept local so the
// package needs no `@cloudflare/workers-types`; an app that installs them gets
// the full types for its own code.
declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown> {
    constructor(ctx: unknown, env: Env);
    protected ctx: {
      acceptWebSocket: (ws: unknown, tags?: string[]) => void;
      getWebSockets: (tag?: string) => unknown[];
      readonly id: { readonly name?: string; toString: () => string };
      setWebSocketAutoResponse: (pair?: unknown) => void;
      readonly storage: {
        readonly sql?: {
          exec: (
            query: string,
            ...bindings: unknown[]
          ) => { toArray: () => Record<string, unknown>[] };
        };
      };
      waitUntil: (promise: Promise<unknown>) => void;
    };
    protected env: Env;
  }
}
