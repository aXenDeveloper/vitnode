import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PostgresTestSchema } from "@/tests/postgres";

import { core_languages, core_languages_words } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  core_moderation_sanctions,
  core_moderation_warning_reasons,
  core_moderation_warning_thresholds,
  core_moderation_warnings,
} from "@/database/warnings";
import {
  WARNING_PERMISSION_MODULE,
  WARNING_PERMISSIONS,
} from "@/lib/moderation/warnings";
import { resolvePersonalInformationFields } from "@/lib/user-personal-information";
import { manifest } from "@/manifest";
import { createTestCache } from "@/tests/cache";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { moderationModule } from "./moderation.module";

const MODERATOR = 1;
const CONCURRENT_MEMBER = 2;
const RETRIED_MEMBER = 3;
const USERS = [MODERATOR, CONCURRENT_MEMBER, RETRIED_MEMBER];

interface Issued {
  duplicate: boolean;
  sanction: null | { id: number };
  warningId: number;
}

describe.skipIf(!POSTGRES_TEST_URL)("issuing warnings on PostgreSQL", () => {
  let schema: PostgresTestSchema;
  let reasonId: number;
  const thresholds: Record<"eight" | "ten", number> = { eight: 0, ten: 0 };
  const cache = createTestCache();
  const publish = vi.fn(async (_args: unknown) => Promise.resolve());

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("user", {
      id: Number(c.req.header("x-user")),
    } as unknown as Context["var"]["user"]);
    c.set("suspension", null);
    c.set("cache", cache);
    c.set("db", schema.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: async () => Promise.resolve(),
    } as unknown as Context["var"]["events"]);
    c.set("notifications", {
      publish,
    } as unknown as Context["var"]["notifications"]);
    c.set("core", {
      moderation: { scopes: [], targets: [] },
      permissionStaff: [],
      personalInformationFields: resolvePersonalInformationFields(),
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.route("/", moderationModule.hono);

  const issue = async (userId: number, idempotencyKey: string) => {
    const res = await app.request("/warnings", {
      body: JSON.stringify({
        idempotencyKey,
        message: "Please keep to the topic.",
        reasonId,
        userId,
      }),
      headers: {
        "content-type": "application/json",
        "x-user": String(MODERATOR),
      },
      method: "POST",
    });
    expect(res.status).toBe(200);

    return (await res.json()) as Issued;
  };

  beforeAll(async () => {
    schema = await createPostgresTestSchema({ prefix: "vitnode_warnings" });
    await schema.db
      .insert(core_languages)
      .values({ code: "en", name: "English" });
    const [role] = await schema.db
      .insert(core_roles)
      .values({ updatedAt: new Date() })
      .returning({ id: core_roles.id });
    await schema.db.insert(core_users).values(
      USERS.map(id => ({
        avatarColor: "000000",
        email: `user${id}@example.com`,
        id,
        ipAddress: "127.0.0.1",
        name: `user${id}`,
        nameCode: `user${id}`,
        roleId: role.id,
      })),
    );
    const [reason] = await schema.db
      .insert(core_moderation_warning_reasons)
      .values({ expiresAfterHours: null, points: 2 })
      .returning({ id: core_moderation_warning_reasons.id });
    reasonId = reason.id;
    await schema.db.insert(core_languages_words).values({
      itemId: reasonId,
      languageCode: "en",
      pluginCode: "core",
      tableName: "core_moderation_warning_reasons",
      value: "Off-topic posting",
      variable: "title",
    });
    const rows = await schema.db
      .insert(core_moderation_warning_thresholds)
      .values([
        { action: "suspend_temporary", durationHours: 24, points: 8 },
        { action: "suspend_indefinite", durationHours: null, points: 10 },
      ])
      .returning({ id: core_moderation_warning_thresholds.id });
    thresholds.eight = rows[0]?.id ?? 0;
    thresholds.ten = rows[1]?.id ?? 0;
    await grantStaffPermissions(cache, {
      permissions: Object.values(WARNING_PERMISSIONS).map(permission => ({
        module: WARNING_PERMISSION_MODULE,
        permission,
        plugin: manifest.id,
      })),
      type: "moderator",
      userId: MODERATOR,
    });
  }, 120_000);

  afterAll(async () => {
    await schema?.drop();
  });

  const warningsOf = async (userId: number) =>
    await schema.db
      .select({
        pointsAfter: core_moderation_warnings.pointsAfter,
        pointsBefore: core_moderation_warnings.pointsBefore,
      })
      .from(core_moderation_warnings)
      .where(eq(core_moderation_warnings.userId, userId))
      .orderBy(asc(core_moderation_warnings.pointsBefore));

  const sanctionsOf = async (userId: number) =>
    await schema.db
      .select({ thresholdId: core_moderation_sanctions.thresholdId })
      .from(core_moderation_sanctions)
      .where(eq(core_moderation_sanctions.userId, userId))
      .orderBy(asc(core_moderation_sanctions.thresholdId));

  it("chains points across concurrent warnings and applies each crossed threshold once", async () => {
    await Promise.all(
      [1, 2, 3, 4, 5].map(
        async n => await issue(CONCURRENT_MEMBER, `concurrent-${n}`),
      ),
    );

    expect(await warningsOf(CONCURRENT_MEMBER)).toEqual([
      { pointsAfter: 2, pointsBefore: 0 },
      { pointsAfter: 4, pointsBefore: 2 },
      { pointsAfter: 6, pointsBefore: 4 },
      { pointsAfter: 8, pointsBefore: 6 },
      { pointsAfter: 10, pointsBefore: 8 },
    ]);
    expect(await sanctionsOf(CONCURRENT_MEMBER)).toEqual([
      { thresholdId: thresholds.eight },
      { thresholdId: thresholds.ten },
    ]);
  });

  it("turns concurrent retries of one request into a single warning", async () => {
    publish.mockClear();

    const results = await Promise.all(
      Array.from(
        { length: 4 },
        async () => await issue(RETRIED_MEMBER, "retried-request"),
      ),
    );

    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(new Set(results.map(result => result.warningId)).size).toBe(1);
    expect(await warningsOf(RETRIED_MEMBER)).toHaveLength(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
