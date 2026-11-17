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

/** Seconds until `opensAt` for a `Retry-After` header, or `null` once it has passed. */
export const retryAfterSeconds = (opensAt: null | string): null | number => {
  const seconds = opensAt
    ? Math.ceil((Date.parse(opensAt) - Date.now()) / 1000)
    : 0;

  return seconds > 0 ? seconds : null;
};

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
  /**
   * Whether the requesting viewer may use the site while it is offline
   * (admins, and moderators with `site_status.can_access_offline`). Always
   * `false` while the site is online.
   */
  viewerCanBypass: z.boolean(),
});

export type SiteStatus = z.output<typeof zodSiteStatus>;

/**
 * What the AdminCP sends to save the site status. Browser-safe. The API also
 * requires a non-empty message in the default language while `offline` is on.
 */
export const zodSiteStatusUpdate = z.object({
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
