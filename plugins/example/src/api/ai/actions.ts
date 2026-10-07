import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Suggests an article teaser from its title and code. The whole feature is
 * this definition plus `ai` on the field: the AdminCP form, the shared
 * assist route, limits and accounting all come from Core.
 */
export const articleExcerptAiAction = defineAiAction({
  authorize: async ({ c }) =>
    await checkStaffPermission(c, {
      module: articleContentType.permissionModule,
      permission: "can_edit",
      plugin: CONFIG_PLUGIN.pluginId,
      type: "admin",
    }),
  buildPrompt: (input, { instructions }) => ({
    prompt: `Title: ${input.title}\nProduct code: ${input.code}`,
    system: [
      "You write a one-sentence teaser for an article in a demo catalogue.",
      `Write it in ${languageName(input.locale)}, under 200 characters.`,
      "Answer with the teaser only, without quotes.",
      ...(instructions ? [instructions] : []),
    ].join("\n"),
  }),
  defaults: {
    maxInputCharacters: 400,
    maxOutputTokens: 120,
    timeoutMs: 20_000,
  },
  description: "ai_actions.@vitnode/example.article_excerpt.description",
  icon: "sparkles",
  id: "article.excerpt",
  title: "ai_actions.@vitnode/example.article_excerpt.title",
  inputSchema: z.object({
    code: z.string().max(100),
    locale: z.string().min(2).max(16),
    title: z.string().min(1).max(200),
  }),
  output: "text",
  outputSchema: z.string().min(1).max(500),
  parseText: text => text.trim().replace(/^["“](.*)["”]$/su, "$1"),
  permission: { defaultGranted: true, key: "article.excerpt" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});
