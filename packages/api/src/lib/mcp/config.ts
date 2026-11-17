/** The `mcp` block of `buildApiConfig`. Every field is optional. */
export interface McpConfig {
  /** Mounts the MCP endpoints and lets members create MCP tokens. Defaults to `false`. */
  enabled?: boolean;
  /** Largest MCP request body read, in bytes. Defaults to 1 MiB. */
  maxRequestBytes?: number;
  /**
   * Largest route response turned into a tool result, in bytes. A larger one
   * is refused with an error the model can act on (ask for a smaller page),
   * never cut. Defaults to 1 MiB.
   */
  maxResponseBytes?: number;
  /**
   * Requests per token: `points` within `duration` seconds. Counted on top of
   * the API's own limits, which still apply to each tool call as to the route
   * it runs. Stored in Redis when `redis` is set. Defaults to 120 per 60 seconds.
   */
  rateLimit?: { duration?: number; points?: number };
  /** The longest lifetime a member may give a token, in days. Defaults to 365. */
  tokenMaxLifetimeDays?: number;
}

/** {@link McpConfig} with its defaults applied. */
export interface ResolvedMcpConfig {
  enabled: boolean;
  maxRequestBytes: number;
  maxResponseBytes: number;
  rateLimit: { duration: number; points: number };
  tokenMaxLifetimeDays: number;
}

const MIB = 1024 * 1024;

const positiveInteger = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : fallback;

export const resolveMcpConfig = (
  config: McpConfig | undefined,
): ResolvedMcpConfig => ({
  enabled: config?.enabled ?? false,
  maxRequestBytes: positiveInteger(config?.maxRequestBytes, MIB),
  maxResponseBytes: positiveInteger(config?.maxResponseBytes, MIB),
  rateLimit: {
    duration: positiveInteger(config?.rateLimit?.duration, 60),
    points: positiveInteger(config?.rateLimit?.points, 120),
  },
  tokenMaxLifetimeDays: positiveInteger(config?.tokenMaxLifetimeDays, 365),
});
