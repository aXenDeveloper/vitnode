import { describe, expect, it } from "vitest";
import { z } from "zod";

import { testManifest } from "@/tests/manifest";

import type { QueueTaskConfig } from "./queue";

import { bindApiPlugin } from "./bind-api-plugin";
import { buildModule } from "./module";
import { buildApiPlugin } from "./plugin";
import {
  buildQueueTask,
  collectPluginQueueTasks,
  QueueTaskRegistrationError,
} from "./queue";

const PLUGIN = "@vitnode/notes";

const reindex = buildQueueTask({
  pluginId: PLUGIN,
  name: "reindex",
  payload: z.object({ noteId: z.number().int() }),
  handler: () => undefined,
});

const inModule = (task: unknown, module = "notes"): QueueTaskConfig =>
  ({ ...(task as object), module }) as QueueTaskConfig;

describe("collectPluginQueueTasks", () => {
  it("keeps the same definition registered by two modules once", () => {
    expect(
      collectPluginQueueTasks(PLUGIN, [
        inModule(reindex, "notes"),
        inModule(reindex, "admin"),
      ]).map(task => task.name),
    ).toEqual(["reindex"]);
  });

  it.each([
    [
      "a task without a payload schema",
      { name: "legacy", pluginId: PLUGIN, handler: () => undefined },
    ],
    [
      "a task without a handler",
      { name: "legacy", pluginId: PLUGIN, payload: z.object({}) },
    ],
    [
      "a task without an owner",
      { name: "legacy", payload: z.object({}), handler: () => undefined },
    ],
    ["another plugin's task", { ...reindex, pluginId: "@vitnode/core" }],
    [
      "two different tasks with one name",
      buildQueueTask({
        pluginId: PLUGIN,
        name: "reindex",
        payload: z.object({ noteId: z.number().int() }),
        handler: () => undefined,
      }),
    ],
  ])("refuses %s", (_, task) => {
    expect(() =>
      collectPluginQueueTasks(PLUGIN, [inModule(reindex), inModule(task)]),
    ).toThrow(QueueTaskRegistrationError);
  });
});

describe("buildApiPlugin queue tasks", () => {
  it("registers a bound task under the plugin that defines it", () => {
    const task = bindApiPlugin(testManifest(PLUGIN)).buildQueueTask({
      name: "reindex",
      payload: z.object({}),
      handler: () => undefined,
    });

    const plugin = buildApiPlugin({
      manifest: testManifest(PLUGIN),
      modules: [
        buildModule({
          pluginId: PLUGIN,
          name: "notes",
          routes: [],
          queueTasks: [task],
        }),
      ],
    });

    expect(plugin.queueTasks).toEqual([
      expect.objectContaining({
        module: "notes",
        name: "reindex",
        pluginId: PLUGIN,
      }),
    ]);
  });
});
