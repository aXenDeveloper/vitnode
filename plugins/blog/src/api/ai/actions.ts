import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
import { assertSameHtmlStructure } from "@vitnode/core/api/lib/ai/html-structure";
import { aiActionRef } from "@vitnode/core/api/lib/ai/registry";
import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
import {
  createRichTextDocumentSchema,
  richTextToHtml,
  richTextToPlainText,
} from "@vitnode/core/content/rich-text";
import { z } from "zod";

import {
  buildExcerptPrompt,
  buildTranslatePrompt,
  excerptSource,
  unquote,
} from "@/api/lib/ai-writing";
import { CONFIG_PLUGIN } from "@/const";

const zodLocale = z.string().min(2).max(16);

export const zodTranslateAiSchema = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("text"),
    from: zodLocale,
    text: z.string().trim().min(1).max(100_000),
    to: zodLocale,
  }),
  z.object({
    document: createRichTextDocumentSchema({ required: true }),
    format: z.literal("richText"),
    from: zodLocale,
    to: zodLocale,
  }),
]);

type TranslateAiInput = z.infer<typeof zodTranslateAiSchema>;

const translateSource = (input: TranslateAiInput) =>
  input.format === "richText"
    ? { format: "html" as const, text: richTextToHtml(input.document) }
    : { format: "text" as const, text: input.text };

export const zodExcerptAiSchema = z.object({
  content: createRichTextDocumentSchema({ required: true }),
  locale: zodLocale,
  title: z.string().trim().min(1).max(255),
});

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

const translateFieldAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) =>
    buildTranslatePrompt(
      { ...translateSource(input), from: input.from, to: input.to },
      instructions,
    ),
  defaults: {
    maxInputCharacters: 100_000,
    maxOutputTokens: 32_000,
    timeoutMs: 120_000,
  },
  description: "ai_actions.@vitnode/blog.field_translate.description",
  icon: "languages",
  id: "field.translate",
  title: "ai_actions.@vitnode/blog.field_translate.title",
  inputSchema: zodTranslateAiSchema,
  measureInput: input => translateSource(input).text.length,
  output: "text",
  outputSchema: z.string().min(1),
  parseText: (text, input) => {
    if (input.format === "text") return unquote(text);
    const translated = text.trim();
    assertSameHtmlStructure(translateSource(input).text, translated);

    return translated;
  },
  permission: { defaultGranted: true, key: "translate" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

const excerptAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) =>
    buildExcerptPrompt(
      { ...input, content: richTextToPlainText(input.content) },
      instructions,
    ),
  defaults: {
    maxInputCharacters: 12_500,
    maxOutputTokens: 300,
    timeoutMs: 30_000,
  },
  description: "ai_actions.@vitnode/blog.excerpt_generate.description",
  icon: "text-quote",
  id: "excerpt.generate",
  title: "ai_actions.@vitnode/blog.excerpt_generate.title",
  inputSchema: zodExcerptAiSchema,
  measureInput: input =>
    input.title.length +
    excerptSource(richTextToPlainText(input.content)).length,
  output: "text",
  outputSchema: z.string().min(1).max(300),
  parseText: text => unquote(text),
  permission: { defaultGranted: true, key: "excerpt" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

const ARTICLE_REVIEW_AREAS = [
  "clarity",
  "completeness",
  "structure",
  "tone",
] as const;

const zodArticleReview = z.object({
  suggestions: z
    .array(
      z.object({
        area: z.enum(ARTICLE_REVIEW_AREAS),
        fix: z
          .object({
            quote: z.string().min(1).max(1_000),
            replacement: z.string().max(1_500),
          })
          .nullable(),
        message: z.string().min(1).max(400),
        priority: z.enum(["high", "low"]),
      }),
    )
    .max(8),
  summary: z.string().min(1).max(400),
});

const articleReviewAiAction = defineAiAction({
  authorize: canEditPosts,
  buildPrompt: (input, { instructions }) => ({
    prompt: `Title: ${input.title}\n\nExcerpt: ${input.excerpt?.trim() ? input.excerpt : "(none)"}\n\nArticle:\n${richTextToPlainText(input.content).slice(0, 30_000)}`,
    system: [
      "You review a blog article draft before it is published and suggest improvements an editor can act on.",
      "Focus on clarity, completeness (missing context, undefined terms, an unclear conclusion), structure and tone.",
      "Do not judge whether facts are true: you cannot verify them. Never claim something is accurate or inaccurate.",
      "Give at most 8 specific suggestions, most useful first. Mark a suggestion high priority only when it clearly hurts readers.",
      "When a suggestion is about specific wording, add a fix: quote is a passage copied character for character from the article, at most one paragraph long, and replacement is the rewritten passage as plain text on one line, or an empty string to delete it. Otherwise set fix to null.",
      `Write the summary and suggestions in the article's language (${input.locale}).`,
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters: 31_000,
    maxOutputTokens: 4_000,
    timeoutMs: 90_000,
  },
  description: "ai_actions.@vitnode/blog.article_review.description",
  icon: "clipboard-check",
  id: "article.review",
  title: "ai_actions.@vitnode/blog.article_review.title",
  inputSchema: z.object({
    content: createRichTextDocumentSchema({ required: true }),
    excerpt: z.string().max(1_000).optional(),
    locale: zodLocale,
    title: z.string().trim().min(1).max(255),
  }),
  measureInput: input =>
    input.title.length +
    (input.excerpt?.length ?? 0) +
    Math.min(richTextToPlainText(input.content).length, 30_000),
  output: "object",
  outputSchema: zodArticleReview,
  permission: { defaultGranted: true, key: "review" },
  promptVersion: 2,
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
