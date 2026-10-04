import type { Context } from "hono";

import { core_queue } from "@/database/queue";

export interface QueueDispatchArgs {
  availableAt?: Date;
  /**
   * Durable deduplication: while a task with this key is pending or running,
   * dispatching it again adds nothing. Enforced by a unique index.
   */
  dedupeKey?: string;
  maxAttempts?: number;
  name: string;
  payload?: Record<string, unknown>;

  pluginId?: string;
  priority?: number;
  queue?: string;

  tx?: Omit<Context["var"]["db"], "$client">;
}

export class QueueModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async dispatch({
    dedupeKey,
    name,
    payload = {},
    pluginId: explicitPluginId,
    queue = "default",
    priority = 0,
    maxAttempts,
    availableAt,
    tx,
  }: QueueDispatchArgs): Promise<{ deduplicated: boolean; id: null | number }> {
    const pluginId =
      explicitPluginId ?? this.c.get("plugin")?.id ?? "@vitnode/core";

    const registeredTask = this.c
      .get("core")
      .queue.find(task => task.pluginId === pluginId && task.name === name);

    const [row] = await (tx ?? this.c.get("db"))
      .insert(core_queue)
      .values({
        pluginId,
        name,
        queue,
        payload,
        priority,
        dedupeKey: dedupeKey ?? null,
        maxAttempts: maxAttempts ?? registeredTask?.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: core_queue.id });

    return row
      ? { deduplicated: false, id: row.id }
      : { deduplicated: true, id: null };
  }
}
