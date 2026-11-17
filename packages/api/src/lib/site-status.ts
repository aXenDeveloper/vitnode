import { z } from "zod";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import {
  createRichTextDocumentSchema,
  isRichTextEmpty,
  zodRichTextDocument,
} from "@/content/rich-text/document";

/** The reason the site is offline: one rich-text document per language. */
export type SiteOfflineMessage = MultiLangValue<RichTextDocument>;

/** Limits of the offline message. */
export const SITE_STATUS_LIMITS = {
  /** Largest serialised document per language, in bytes. */
  messageMaxBytes: 64 * 1024,
} as const;

/** The page-cache tag every render that read the site status carries. */
export const SITE_STATUS_PAGE_CACHE_TAG = "core:site-status";

/** What `GET /api/core/site/status` answers. Browser-safe. */
export const zodSiteStatus = z.object({
  offline: z.boolean(),
  message: z.array(
    z.object({ languageCode: z.string(), value: zodRichTextDocument }),
  ),
  opensAt: z.string().nullable(),
  showCountdown: z.boolean(),
  /** The server's clock when it answered, so a countdown can correct skew. */
  serverNow: z.string(),
});

export type SiteStatus = z.output<typeof zodSiteStatus>;

/**
 * What the AdminCP sends to save the site status. Browser-safe, so the form
 * validates with the same rules. `message` needs a non-empty document in at
 * least one language while `offline` is on; the API also requires the
 * default language.
 */
export const zodSiteStatusUpdate = z
  .object({
    offline: z.boolean(),
    message: z
      .array(
        z.object({
          languageCode: z.string().min(1).max(20),
          value: createRichTextDocumentSchema({
            maxBytes: SITE_STATUS_LIMITS.messageMaxBytes,
          }),
        }),
      )
      .default([]),
    opensAt: z.iso.datetime({ offset: true }).nullable().default(null),
    showCountdown: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.offline &&
      !value.message.some(item => !isRichTextEmpty(item.value))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "message_required",
        path: ["message"],
      });
    }
  });

export type SiteStatusUpdate = z.output<typeof zodSiteStatusUpdate>;

/**
 * The message in `languageCode`, falling back to `defaultLanguageCode`, then
 * to the first non-empty one. `null` when every language is empty.
 */
export const pickSiteOfflineMessage = (
  message: SiteOfflineMessage,
  languageCode: string,
  defaultLanguageCode?: string,
): null | RichTextDocument => {
  const filled = message.filter(item => !isRichTextEmpty(item.value));

  return (
    (
      filled.find(item => item.languageCode === languageCode) ??
      filled.find(item => item.languageCode === defaultLanguageCode) ??
      filled[0]
    )?.value ?? null
  );
};
