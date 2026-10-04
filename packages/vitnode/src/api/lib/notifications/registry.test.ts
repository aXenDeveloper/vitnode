import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildNotificationSubject,
  buildNotificationType,
  createNotificationRegistry,
  parseStoredNotificationData,
} from "./registry";

const base = {
  category: "social",
  defaults: { email: "none" as const, inApp: true },
  label: "x.label",
  present: () => ({ title: "t" }),
  schema: z.object({ n: z.number() }),
  version: 1,
};

describe("buildNotificationType", () => {
  it("accepts a plugin-scoped id", () => {
    expect(buildNotificationType({ ...base, id: "blog.comment" }).id).toBe(
      "blog.comment",
    );
  });

  it.each(["comment", "Blog.Comment", "blog..comment", "blog comment"])(
    "rejects the id %s",
    id => {
      expect(() => buildNotificationType({ ...base, id })).toThrow(
        /Invalid notification type id/,
      );
    },
  );

  it("refuses an email default without an email presentation", () => {
    expect(() =>
      buildNotificationType({
        ...base,
        defaults: { email: "daily", inApp: true },
        id: "blog.comment",
      }),
    ).toThrow(/declares no email presentation/);
  });

  it("bounds the grouping window", () => {
    expect(() =>
      buildNotificationType({
        ...base,
        grouping: { windowMinutes: 0 },
        id: "blog.comment",
      }),
    ).toThrow(/grouping window/);
  });
});

describe("createNotificationRegistry", () => {
  const comment = buildNotificationType({ ...base, id: "blog.comment" });

  it("refuses the same id from two plugins", () => {
    expect(() =>
      createNotificationRegistry([
        { definition: comment, pluginId: "@acme/a" },
        { definition: { ...comment }, pluginId: "@acme/b" },
      ]),
    ).toThrow(/Duplicate notification type "blog.comment"/);
  });

  it("refuses a subject registered twice", () => {
    const subject = buildNotificationSubject({ type: "blog.category" });

    expect(() =>
      createNotificationRegistry(
        [],
        [
          { definition: subject, pluginId: "@acme/a" },
          { definition: subject, pluginId: "@acme/b" },
        ],
      ),
    ).toThrow(/Duplicate notification subject/);
  });

  it("makes a type's undeclared subject mutable but not followable", () => {
    const registry = createNotificationRegistry([
      {
        definition: { ...comment, subjectType: "blog.post" },
        pluginId: "@acme/a",
      },
    ]);

    expect(registry.getSubject("blog.post")?.definition.followable).toBe(false);
  });
});

describe("parseStoredNotificationData", () => {
  const v2 = buildNotificationType({
    ...base,
    id: "blog.comment",
    migrate: (data, from) =>
      from === 1 ? { n: Number((data as { count: string }).count) } : data,
    schema: z.object({ n: z.number() }),
    version: 2,
  });

  it("upgrades data stored by an older version", () => {
    expect(parseStoredNotificationData(v2, { count: "3" }, 1)).toEqual({
      n: 3,
    });
  });

  it("gives up on data it cannot read, instead of rendering garbage", () => {
    expect(parseStoredNotificationData(v2, { n: "nope" }, 2)).toBeNull();
    expect(parseStoredNotificationData(v2, { n: 1 }, 3)).toBeNull();
  });
});
