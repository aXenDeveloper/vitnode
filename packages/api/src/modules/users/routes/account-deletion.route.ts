import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { ACCOUNT_DELETION_SOURCES } from "@/database/account-deletions";
import { core_users } from "@/database/users";
import {
  cancelAccountDeletion,
  canDeleteOwnAccount,
  findOpenAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account-deletion/requests";
import { isStaff } from "@/lib/check-staff-permission";
import { PasswordModel } from "@/models/password";
import { SessionModel } from "@/models/session";

import { USER_PASSWORD_MAX_LENGTH } from "../lib/credential-limits";

/** How recent a sign-in must be to delete an account that has no password. */
export const ACCOUNT_DELETION_RECENT_AUTH_MS = 15 * 60_000;

const zodPendingDeletion = z
  .object({
    createdAt: z.date(),
    scheduledAt: z.date(),
    source: z.enum(ACCOUNT_DELETION_SOURCES),
  })
  .nullable();

const zodError = z.object({
  error: z.enum([
    "invalid_password",
    "not_allowed",
    "password_required",
    "reauthentication_required",
    "staff_account",
  ]),
});

const requireUser = (user: null | { id: number; roleId: number }) => {
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });

  return user;
};

export const accountDeletionStatusRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "get",
    description:
      "The signed-in member's pending account deletion, and what deleting the account requires.",
    path: "/me/account-deletion",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              /** `false` when one of the member's roles turns self-deletion off. */
              allowed: z.boolean(),
              graceDays: z.number().int(),
              hasPassword: z.boolean(),
              pending: zodPendingDeletion,
              staff: z.boolean(),
            }),
          },
        },
        description: "Account deletion status",
      },
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = requireUser(c.get("user"));

    const [[row], pending, staff, allowed] = await Promise.all([
      c
        .get("db")
        .select({ password: core_users.password })
        .from(core_users)
        .where(eq(core_users.id, user.id))
        .limit(1),
      findOpenAccountDeletion(c, user.id),
      isStaff(c, { live: true, type: "admin", userId: user.id }),
      canDeleteOwnAccount(c, user),
    ]);

    return c.json(
      {
        allowed,
        graceDays: c.get("core").privacy.deletionGraceDays,
        hasPassword: !!row?.password,
        pending: pending
          ? {
              createdAt: pending.createdAt,
              scheduledAt: pending.scheduledAt,
              source: pending.source,
            }
          : null,
        staff,
      },
      200,
    );
  },
});

export const requestAccountDeletionRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Schedules the signed-in member's account for deletion after the grace period (`users.accountDeletion.graceDays`). Requires the password, or a sign-in in the last 15 minutes for an account without one. Signs the account out everywhere and emails how to cancel. Refused for AdminCP staff and for members of a role without `allowDeleteAccount`.",
    path: "/me/account-deletion",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              password: z
                .string()
                .max(USER_PASSWORD_MAX_LENGTH)
                .optional()
                .openapi({ example: "Test123!" }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ scheduledAt: z.date() }),
          },
        },
        description: "Deletion scheduled",
      },
      400: {
        content: { "application/json": { schema: zodError } },
        description: "Wrong or missing password",
      },
      401: { description: "Unauthorized" },
      403: {
        content: { "application/json": { schema: zodError } },
        description:
          "The account has no password and the sign-in is not recent, it belongs to AdminCP staff, or a role does not allow deleting the account",
      },
    },
  },
  handler: async c => {
    const user = requireUser(c.get("user"));
    const { password } = c.req.valid("json");

    if (await isStaff(c, { live: true, type: "admin", userId: user.id })) {
      return c.json({ error: "staff_account" as const }, 403);
    }
    if (!(await canDeleteOwnAccount(c, user))) {
      return c.json({ error: "not_allowed" as const }, 403);
    }

    const [row] = await c
      .get("db")
      .select({ password: core_users.password })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .limit(1);

    const passwords = new PasswordModel();
    if (row?.password) {
      if (!password) {
        return c.json({ error: "password_required" as const }, 400);
      }
      if (!(await passwords.verifyPassword(password, row.password))) {
        return c.json({ error: "invalid_password" as const }, 400);
      }
    } else {
      const signedInAt = await new SessionModel(c).getSessionCreatedAt();
      if (
        signedInAt === null ||
        Date.now() - signedInAt.getTime() > ACCOUNT_DELETION_RECENT_AUTH_MS
      ) {
        return c.json({ error: "reauthentication_required" as const }, 403);
      }
    }

    const deletion = await scheduleAccountDeletion(c, {
      requestedById: user.id,
      source: "user",
      userId: user.id,
    });

    return c.json({ scheduledAt: deletion.scheduledAt }, 201);
  },
});

export const cancelAccountDeletionRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "delete",
    description:
      "Cancels the signed-in member's pending account deletion; the account stays as it was.",
    path: "/me/account-deletion",
    responses: {
      200: { description: "Deletion cancelled" },
      401: { description: "Unauthorized" },
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "No deletion is pending",
      },
    },
  },
  handler: async c => {
    const user = requireUser(c.get("user"));

    if (!(await cancelAccountDeletion(c, user.id))) {
      return c.json({ error: "No deletion is pending" }, 404);
    }

    return c.body(null, 200);
  },
});
