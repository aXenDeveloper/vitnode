import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
import { assertSameHtmlStructure } from "@vitnode/core/api/lib/ai/html-structure";
import { aiActionRef } from "@vitnode/core/api/lib/ai/registry";
import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
import { z } from "zod";

import {
  buildExcerptPrompt,
  buildTranslatePrompt,
  excerptSource,
  unquote,
} from "@/api/lib/ai-writing";
import { CONFIG_PLUGIN } from "@/const";

const zodLocale = z.string().min(2).max(16);

export const zodTranslateAiSchema = z.object({
  format: z.enum(["html", "text"]),
  from: zodLocale,
  text: z.string().trim().min(1).max(100_000),
  to: zodLocale,
});

export const zodExcerptAiSchema = z.object({
  content: z.string().trim().min(1).max(200_000),
  locale: zodLocale,
  title: z.string().trim().min(1).max(255),
});

/**
 * Articles are edited by staff who may edit posts. The AI permission adds to
 * that check - it never replaces it.
 */
const canEditPosts = async ({
  c,
}: {
  c: Parameters<typeof checkStaffPermission>[0];
}) =>
  await checkStaffPermission(c, {
    module: "posts",
    permission: "can_edit",
    plugin: CONFIG_PLUGIN.pluginId,
    type: "admin",
  });

export const translateFieldAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) =>
    buildTranslatePrompt(input, instructions),
  defaults: {
    maxInputCharacters: 100_000,
    maxOutputTokens: 32_000,
    timeoutMs: 120_000,
  },
  description: "Translates one field of an article into another language.",
  id: "field.translate",
  inputSchema: zodTranslateAiSchema,
  measureInput: input => input.text.length,
  output: "text",
  outputSchema: z.string().min(1),
  // Rich text keeps its structure or is refused: links, attributes and blocks
  // are compared tag by tag, not trusted to the prompt.
  parseText: (text, input) => {
    if (input.format === "text") return unquote(text);
    const translated = text.trim();
    assertSameHtmlStructure(input.text, translated);

    return translated;
  },
  permission: { defaultGranted: true, key: "translate" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

export const excerptAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) =>
    buildExcerptPrompt(input, instructions),
  defaults: {
    maxInputCharacters: 12_500,
    maxOutputTokens: 300,
    timeoutMs: 30_000,
  },
  description: "Writes a short excerpt for an article.",
  id: "excerpt.generate",
  inputSchema: zodExcerptAiSchema,
  measureInput: input =>
    input.title.length + excerptSource(input.content).length,
  output: "text",
  outputSchema: z.string().min(1).max(300),
  parseText: text => unquote(text),
  permission: { defaultGranted: true, key: "excerpt" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

export const blogAiActions = [translateFieldAiAction, excerptAiAction];

export const TRANSLATE_FIELD_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  translateFieldAiAction,
);
export const EXCERPT_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  excerptAiAction,
);
