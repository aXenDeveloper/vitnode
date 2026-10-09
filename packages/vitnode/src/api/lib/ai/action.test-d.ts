import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { defineAiAction } from "./action";

describe("defineAiAction inference", () => {
  it("types buildPrompt and parseText from the schemas", () => {
    const action = defineAiAction({
      authorize: ({ input }) => {
        expectTypeOf(input).toEqualTypeOf<{ locale: string; title: string }>();

        return true;
      },
      buildPrompt: input => {
        expectTypeOf(input.title).toBeString();

        return { prompt: input.title };
      },
      defaults: {
        maxInputCharacters: 10,
        maxOutputTokens: 10,
        timeoutMs: 5_000,
      },
      description: "Test action.",
      id: "title.rewrite",
      title: "Test action",
      inputSchema: z.object({ locale: z.string(), title: z.string() }),
      output: "text",
      outputSchema: z.object({ title: z.string() }),
      parseText: text => ({ title: text }),
      permission: "title",
      promptVersion: 1,
      requiredCapabilities: ["text"],
    });

    expectTypeOf(action.id).toEqualTypeOf<"title.rewrite">();
  });

  it("rejects an unknown capability at compile time", () => {
    defineAiAction({
      actors: ["system"],
      buildPrompt: () => ({ prompt: "x" }),
      defaults: {
        maxInputCharacters: 10,
        maxOutputTokens: 10,
        timeoutMs: 5_000,
      },
      description: "Test action.",
      id: "x.y",
      title: "Test action",
      inputSchema: z.object({}),
      output: "text",
      outputSchema: z.string(),
      parseText: text => text,
      permission: "x",
      promptVersion: 1,
      // @ts-expect-error - "telepathy" is not a model capability.
      requiredCapabilities: ["telepathy"],
    });
  });
});
