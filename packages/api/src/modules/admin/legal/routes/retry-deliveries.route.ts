import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { throwLegalError } from "@/lib/legal/acceptance.server";
import { LEGAL_ERROR_CODES } from "@/lib/legal/contract";
import { retryLegalDeliveries } from "@/lib/legal/delivery.server";

import { zodVersionIdParam } from "../legal.schema";
import { adminLegalVersion } from "../lib";

export const retryDeliveriesLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canPublish,
  route: {
    method: "post",
    description:
      "Send the announcement email again to members whose delivery failed: all of them, or the given deliveries. Each gets a fresh attempt budget; the provider idempotency key stays the same.",
    path: "/versions/{id}/deliveries/retry",
    request: {
      params: zodVersionIdParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              deliveryIds: z
                .array(z.number().int().positive())
                .max(500)
                .optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ retried: z.number().int() }),
          },
        },
        description: "Queued again",
      },
      404: { description: "No such version" },
      409: { description: "`LEGAL_EMAIL_ADAPTER_MISSING`" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { deliveryIds } = c.req.valid("json");
    const version = await adminLegalVersion(c, id);
    if (!version) throw new HTTPException(404);
    if (!c.get("core").email?.adapter) {
      return throwLegalError(409, LEGAL_ERROR_CODES.emailAdapterMissing);
    }

    const retried = await retryLegalDeliveries(c, id, deliveryIds);
    if (retried > 0) {
      await writeAuditLog(c, {
        action: "legal.deliveries_retried",
        metadata: { retried, version: version.version },
        target: {
          id,
          label: `${version.documentType} v${version.version}`,
          type: "legal_document",
        },
      });
    }

    return c.json({ retried }, 200);
  },
});
