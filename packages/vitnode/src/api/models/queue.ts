import type { Context } from "hono";

import { core_queue } from "@/database/queue";

export interface QueueDispatchArgs {
  availableAt?: Date;
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
    name,
    payload = {},
    pluginId: explicitPluginId,
    queue = "default",
    priority = 0,
    maxAttempts,
    availableAt,
    tx,
  }: QueueDispatchArgs): Promise<{ id: number }> {
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
        maxAttempts: maxAttempts ?? registeredTask?.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .returning({ id: core_queue.id });

    return row;
  }
}
