// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildApiPlugin } from "../plugin";
import { AiActionDefinitionError, defineAiAction } from "./action";
import { collectAiActions, UnknownAiActionError } from "./registry";

const summarize = (id = "summary.generate") =>
  defineAiAction({
    authorize: () => true,
    buildPrompt: input => ({ prompt: input.text }),
    defaults: {
      maxInputCharacters: 1_000,
      maxOutputTokens: 100,
      timeoutMs: 10_000,
    },
    id,
    inputSchema: z.object({ text: z.string() }),
    output: "text",
    outputSchema: z.string().min(1),
    parseText: text => text.trim(),
    permission: "summary",
    promptVersion: 1,
    requiredCapabilities: ["text"],
  });

describe("defineAiAction", () => {
  it("fills safe defaults and normalises the permission", () => {
    const action = summarize();

    expect(action.defaults).toMatchObject({
      dailyLimit: null,
      maxImages: 0,
      maxRetries: 0,
      maxSteps: 1,
    });
    expect(action.permission).toEqual({
      defaultGranted: false,
      key: "summary",
    });
    expect(action.actors).toEqual(["user"]);
  });

  it.each([
    ["an invalid id", { id: "Bad Id" }],
    ["a zero prompt version", { promptVersion: 0 }],
    ["no capabilities", { requiredCapabilities: [] }],
    ["an unsupported capability", { requiredCapabilities: ["telepathy"] }],
    [
      "an out-of-range timeout",
      {
        defaults: { maxInputCharacters: 10, maxOutputTokens: 10, timeoutMs: 5 },
      },
    ],
    [
      "too many retries",
      {
        defaults: {
          maxInputCharacters: 10,
          maxOutputTokens: 10,
          maxRetries: 9,
          timeoutMs: 5_000,
        },
      },
    ],
    ["a user action without authorize()", { authorize: undefined }],
  ])("refuses %s", (_label, override) => {
    expect(() =>
      defineAiAction({
        ...summarize(),
        permission: "summary",
        ...override,
      } as never),
    ).toThrow(AiActionDefinitionError);
  });

  it("requires structured-output for object actions and image-input bounds for vision", () => {
    expect(() =>
      defineAiAction({
        actors: ["system"],
        buildPrompt: () => ({ prompt: "x" }),
        defaults: {
          maxInputCharacters: 10,
          maxOutputTokens: 10,
          timeoutMs: 5_000,
        },
        id: "facts.extract",
        inputSchema: z.object({}),
        output: "object",
        outputSchema: z.object({ facts: z.array(z.string()) }),
        permission: "facts",
        promptVersion: 1,
        requiredCapabilities: ["text"],
      }),
    ).toThrow(/structured-output/);

    const vision = defineAiAction({
      actors: ["system"],
      buildPrompt: () => ({ prompt: "x" }),
      defaults: {
        maxInputCharacters: 10,
        maxOutputTokens: 10,
        timeoutMs: 5_000,
      },
      id: "media.describe",
      inputSchema: z.object({}),
      output: "text",
      outputSchema: z.string(),
      parseText: text => text,
      permission: "media",
      promptVersion: 1,
      requiredCapabilities: ["text", "image-input"],
    });

    expect(vision.defaults.maxImages).toBe(1);
  });
});

describe("AI action registry", () => {
  it("names actions by plugin and local id", () => {
    const registry = collectAiActions([
      { aiActions: [summarize()], pluginId: "@acme/blog" },
    ]);

    expect(registry.get("@acme/blog:summary.generate").permissionKey).toBe(
      "@acme/blog:summary",
    );
  });

  it("allows the same local id in two plugins", () => {
    const registry = collectAiActions([
      { aiActions: [summarize()], pluginId: "@acme/blog" },
      { aiActions: [summarize()], pluginId: "@acme/forum" },
    ]);

    expect(registry.all()).toHaveLength(2);
  });

  it("refuses a duplicate canonical identity", () => {
    expect(() =>
      collectAiActions([
        { aiActions: [summarize(), summarize()], pluginId: "@acme/blog" },
      ]),
    ).toThrow(/registered twice/);
  });

  it("refuses the duplicate already when the plugin is built", () => {
    expect(() =>
      buildApiPlugin({
        aiActions: [summarize(), summarize()],
        pluginId: "@acme/blog",
      }),
    ).toThrow(AiActionDefinitionError);
  });

  it("throws a named error for an unknown action", () => {
    const registry = collectAiActions([]);

    expect(() => registry.get("@acme/blog:nope")).toThrow(UnknownAiActionError);
    expect(registry.find("@acme/blog:nope")).toBeUndefined();
  });

  it("projects only serializable metadata", () => {
    const registry = collectAiActions([
      { aiActions: [summarize()], pluginId: "@acme/blog" },
    ]);
    const [metadata] = registry.publicMetadata();

    expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);
    expect(metadata).not.toHaveProperty("buildPrompt");
    expect(metadata).not.toHaveProperty("inputSchema");
    expect(metadata).toMatchObject({
      key: "@acme/blog:summary.generate",
      permission: { key: "@acme/blog:summary" },
    });
  });
});
