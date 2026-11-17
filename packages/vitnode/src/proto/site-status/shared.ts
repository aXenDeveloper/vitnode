import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@vitnode/api/content/rich-text/document";
import { z } from "zod";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminSiteStatus,
  AdminSiteStatusInput,
} from "@/views/admin/views/core/system/site-status/site-status-query";

export interface ProtoProps {
  canManage: boolean;
  data: AdminSiteStatus;
  fetchedAt: number;
  onSave: (values: AdminSiteStatusInput) => Promise<AdminMutationResult<true>>;
}

const documentSchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

const isPast = (iso: string): boolean => Date.parse(iso) <= Date.now();

/** The whole site status as one form: switch, message, opening time, countdown. */
export const statusFormSchema = (data: AdminSiteStatus) =>
  z
    .object({
      offline: z.boolean().default(data.offline),
      message: z
        .array(z.object({ languageCode: z.string(), value: documentSchema }))
        .default(
          data.message.map(item => ({
            languageCode: item.languageCode,
            value: { ...item.value },
          })),
        ),
      opensAt: z.string().nullable().default(data.opensAt),
      showCountdown: z.boolean().default(data.showCountdown),
    })
    .superRefine((values, ctx) => {
      if (
        values.offline &&
        !values.message.some(
          item =>
            isRichTextDocument(item.value) && !isRichTextEmpty(item.value),
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Write a message so visitors know what's going on.",
          path: ["message"],
        });
      }
      if (
        values.opensAt !== null &&
        values.opensAt !== data.opensAt &&
        isPast(values.opensAt)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Pick a time in the future.",
          path: ["opensAt"],
        });
      }
    });

export const toPayload = (values: {
  message: { languageCode: string; value: unknown }[];
  offline: boolean;
  opensAt: null | string;
  showCountdown: boolean;
}): AdminSiteStatusInput => ({
  message: values.message.flatMap(item =>
    isRichTextDocument(item.value) && !isRichTextEmpty(item.value)
      ? [{ languageCode: item.languageCode, value: item.value }]
      : [],
  ),
  offline: values.offline,
  opensAt: values.opensAt,
  showCountdown: values.showCountdown,
});
