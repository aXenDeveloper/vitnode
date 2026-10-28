import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { findReportTarget } from "@/api/lib/moderation/registry";
import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";
import {
  isSanctionActiveAt,
  WARNING_STATUSES,
  warningStatusAt,
} from "@/lib/moderation/warnings";

import { json } from "../lib/schema";
import { loadActivePoints } from "../lib/warnings-service";
import { loadUserSanctions, loadUserWarnings } from "../lib/warnings-view";

const textSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

/**
 * What a member may read about their own warnings. Built field by field so
 * staff notes, override explanations, revocation reasons and the issuing
 * moderator never leave the server.
 */
const ownWarningSchema = z.object({
  id: z.number(),
  status: z.enum(WARNING_STATUSES),
  points: z.number(),
  reason: textSchema.nullable(),
  message: z.string(),
  issuedAt: z.date(),
  expiresAt: z.date().nullable(),
  content: z
    .object({ title: z.string().nullable(), url: z.string().nullable() })
    .nullable(),
});

const ownSanctionSchema = z.object({
  id: z.number(),
  active: z.boolean(),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  revoked: z.boolean(),
  warningId: z.number().nullable(),
});

export const accountStatusRoute = buildRoute({
  route: {
    method: "get",
    path: "/account-status",
    description:
      "The signed-in member's own standing: active warning points, warning history and suspensions. Also answers for a suspended account, whose session is otherwise treated as a guest. Never includes staff notes",
    responses: {
      200: json(
        z.object({
          suspension: z.object({ endsAt: z.date().nullable() }).nullable(),
          activePoints: z.number(),
          warnings: z.array(ownWarningSchema),
          sanctions: z.array(ownSanctionSchema),
        }),
        "The account's standing",
      ),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const userId = c.get("user")?.id ?? c.get("suspension")?.userId;
    if (!userId) return c.json({ error: "unauthenticated" }, 401);

    const now = new Date();
    const [warnings, sanctions, activePoints, suspension] = await Promise.all([
      loadUserWarnings(c, userId),
      loadUserSanctions(c, userId),
      loadActivePoints(c.get("db"), userId, now),
      findActiveSuspension(c, userId, now),
    ]);
    const registry = c.get("core").moderation;

    const contentOf = async (row: (typeof warnings)[number]) => {
      if (!row.pluginId || !row.targetType || !row.targetId) return null;
      const target = findReportTarget(registry, {
        pluginId: row.pluginId,
        type: row.targetType,
      });
      // Link only to content that is still there and not hidden.
      const current = target
        ? await target.definition
            .current(c, { locale: null, targetId: row.targetId })
            .catch(() => null)
        : null;

      return {
        title: row.contentSnapshot?.title ?? null,
        url: current && !current.hidden ? current.url : null,
      };
    };

    return c.json(
      {
        suspension: suspension ? { endsAt: suspension.endsAt } : null,
        activePoints,
        warnings: await Promise.all(
          warnings.map(async row => ({
            id: row.id,
            status: warningStatusAt(row, now),
            points: row.points,
            reason: row.reasonSnapshot?.title ?? null,
            message: row.message,
            issuedAt: row.issuedAt,
            expiresAt: row.expiresAt,
            content: await contentOf(row),
          })),
        ),
        sanctions: sanctions.map(row => ({
          id: row.id,
          active: isSanctionActiveAt(row, now),
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          revoked: row.revokedAt !== null,
          warningId: row.warningId,
        })),
      },
      200,
    );
  },
});
