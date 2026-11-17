import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { isRichTextEmpty } from "@/content/rich-text/document";
import { siteStatusUpdatedEvent } from "@/events/site";
import { auditDiff } from "@/lib/audit/diff";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { zodSiteStatusUpdate } from "@/lib/site-status";
import {
  afterSiteStatusSaved,
  loadSiteStatus,
  saveSiteStatus,
} from "@/lib/site-status.server";

export const updateSiteStatusAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.site_status.canManage,
  route: {
    method: "put",
    description:
      "Switch the public site off or on, and set the reason and the planned opening time.",
    path: "/status",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodSiteStatusUpdate } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
      400: {
        description:
          "The reason is missing in the default language, or the opening time is in the past",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    if (body.offline) {
      const defaultLocale = c.get("core").i18n.defaultLocale;
      const defaultMessage = body.message.find(
        item => item.languageCode === defaultLocale,
      );
      if (!defaultMessage || isRichTextEmpty(defaultMessage.value)) {
        throw new HTTPException(400, {
          message: "Write the reason in the default language.",
        });
      }
    }
    // A countdown that already ran out may stay as it is; a new time must be
    // in the future.
    const current = await loadSiteStatus(c);
    const opensAtChanged =
      body.opensAt !== null &&
      (current.opensAt === null ||
        Date.parse(current.opensAt) !== Date.parse(body.opensAt));
    if (
      body.opensAt &&
      opensAtChanged &&
      Date.parse(body.opensAt) <= Date.now()
    ) {
      throw new HTTPException(400, {
        message: "The opening time must be in the future.",
      });
    }

    const { switched } = await c.get("db").transaction(async tx => {
      const saved = await saveSiteStatus(tx, body, admin.user.id);
      const before = saved.before;
      const changes = auditDiff({
        after: {
          offline: body.offline,
          opensAt: body.opensAt,
          showCountdown: body.showCountdown,
        },
        before: before
          ? {
              offline: before.offline,
              opensAt: before.opensAt?.toISOString() ?? null,
              showCountdown: before.showCountdown,
            }
          : null,
        include: ["offline", "opensAt", "showCountdown"],
      });
      const messageChanged =
        JSON.stringify(before?.message ?? []) !== JSON.stringify(body.message);
      if (changes || messageChanged) {
        await writeAuditLog(
          c,
          {
            action: "settings.updated",
            changes,
            target: {
              id: "site_status",
              label: "Site status",
              type: "settings",
            },
          },
          tx,
        );
      }

      return saved;
    });

    await afterSiteStatusSaved(c);
    await c.get("events").emit(siteStatusUpdatedEvent, {
      changedById: admin.user.id,
      offline: body.offline,
      opensAt: body.opensAt,
      switched,
    });

    return c.json({ ok: true as const }, 200);
  },
});
