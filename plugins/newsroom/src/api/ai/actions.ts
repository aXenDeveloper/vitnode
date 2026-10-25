import { defineAiAction } from "@vitnode/core/api/lib/ai/action";
import { languageName } from "@vitnode/core/api/lib/ai/language-name";
import { checkStaffPermission } from "@vitnode/core/api/lib/check-staff-permission";
import { z } from "zod";

import { storyContentType } from "@/content/story";
import { manifest } from "@/manifest.gen";

export const storyExcerptAiAction = defineAiAction({
  authorize: async ({ c }) =>
    await checkStaffPermission(c, {
      module: storyContentType.permissionModule,
      permission: "can_edit",
      plugin: manifest.id,
      type: "admin",
    }),
  buildPrompt: (input, { instructions }) => ({
    prompt: `Title: ${input.title}\nReference code: ${input.code}`,
    system: [
      "You write a one-sentence teaser for a newsroom story.",
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
  description: "ai_actions.newsroom.story_excerpt.description",
  icon: "sparkles",
  id: "story.excerpt",
  title: "ai_actions.newsroom.story_excerpt.title",
  inputSchema: z.object({
    code: z.string().max(100),
    locale: z.string().min(2).max(16),
    title: z.string().min(1).max(200),
  }),
  output: "text",
  outputSchema: z.string().min(1).max(500),
  parseText: text => text.trim().replace(/^["“](.*)["”]$/su, "$1"),
  permission: { defaultGranted: true, key: "story.excerpt" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});
