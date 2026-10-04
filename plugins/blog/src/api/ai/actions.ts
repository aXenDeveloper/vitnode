import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
import { assertSameHtmlStructure } from "@vitnode/core/api/lib/ai/html-structure";
import { aiActionRef } from "@vitnode/core/api/lib/ai/registry";
import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
import { stripHtml } from "@vitnode/core/lib/strip-html";
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

export const ARTICLE_REVIEW_AREAS = [
  "clarity",
  "completeness",
  "structure",
  "tone",
] as const;

export const zodArticleReview = z.object({
  suggestions: z
    .array(
      z.object({
        area: z.enum(ARTICLE_REVIEW_AREAS),
        message: z.string().min(1).max(400),
        priority: z.enum(["high", "low"]),
      }),
    )
    .max(8),
  summary: z.string().min(1).max(400),
});

/**
 * An optional editorial read-through before publishing: suggestions about
 * clarity and completeness, as structured data. It never verifies facts -
 * it has no evidence to check them against - and it never blocks or
 * publishes anything.
 */
export const articleReviewAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) => ({
    prompt: `Title: ${input.title}\n\nExcerpt: ${input.excerpt?.trim() ? input.excerpt : "(none)"}\n\nArticle:\n${stripHtml(input.content).slice(0, 30_000)}`,
    system: [
      "You review a blog article draft before it is published and suggest improvements an editor can act on.",
      "Focus on clarity, completeness (missing context, undefined terms, an unclear conclusion), structure and tone.",
      "Do not judge whether facts are true: you cannot verify them. Never claim something is accurate or inaccurate.",
      "Give at most 8 specific suggestions, most useful first. Mark a suggestion high priority only when it clearly hurts readers.",
      `Write the summary and suggestions in the article's language (${input.locale}).`,
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters: 31_000,
    maxOutputTokens: 1_500,
    timeoutMs: 90_000,
  },
  description:
    "Suggests clarity and completeness improvements before publishing.",
  id: "article.review",
  inputSchema: z.object({
    content: z.string().trim().min(1).max(200_000),
    excerpt: z.string().max(1_000).optional(),
    locale: zodLocale,
    title: z.string().trim().min(1).max(255),
  }),
  measureInput: input =>
    input.title.length +
    (input.excerpt?.length ?? 0) +
    Math.min(stripHtml(input.content).length, 30_000),
  output: "object",
  outputSchema: zodArticleReview,
  permission: { defaultGranted: true, key: "review" },
  promptVersion: 1,
  requiredCapabilities: ["text", "structured-output"],
});

export const blogAiActions = [
  translateFieldAiAction,
  excerptAiAction,
  articleReviewAiAction,
];

export const TRANSLATE_FIELD_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  translateFieldAiAction,
);
export const ARTICLE_REVIEW_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  articleReviewAiAction,
);
export const EXCERPT_AI_ACTION = aiActionRef(
  CONFIG_PLUGIN.pluginId,
  excerptAiAction,
);
