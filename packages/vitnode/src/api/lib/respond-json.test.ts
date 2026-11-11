import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  projectResponse,
  respondJson,
  ResponseProjectionError,
} from "./respond-json";

const SECRET = "s3cret-hash";

const projectionError = (run: () => unknown): ResponseProjectionError => {
  try {
    run();
  } catch (error) {
    if (error instanceof ResponseProjectionError) return error;
    throw error;
  }
  throw new Error("expected a ResponseProjectionError");
};

describe("projectResponse", () => {
  it("omits undeclared fields at every depth", () => {
    const schema = z.object({
      author: z.object({ id: z.number() }).nullable(),
      id: z.number(),
      tags: z.array(z.object({ name: z.string() })),
      byLocale: z.record(z.string(), z.object({ title: z.string() })),
      pair: z.tuple([z.object({ a: z.number() })]),
      note: z.string().optional(),
    });
    const value = {
      author: { email: SECRET, id: 1 },
      byLocale: { en: { passwordHash: SECRET, title: "Hi" } },
      id: 7,
      pair: [{ a: 1, token: SECRET }],
      passwordHash: SECRET,
      tags: [{ name: "a", ownerIp: SECRET }],
    };

    const projected = projectResponse(
      schema,
      value as unknown as z.output<typeof schema>,
    );

    expect(projected).toEqual({
      author: { id: 1 },
      byLocale: { en: { title: "Hi" } },
      id: 7,
      pair: [{ a: 1 }],
      tags: [{ name: "a" }],
    });
    expect("note" in projected).toBe(false);
  });

  it.each([
    ["a loose object", z.looseObject({ id: z.number() })],
    ["a catchall", z.object({ id: z.number() }).catchall(z.string())],
  ])("drops extras even from %s", (_, schema) => {
    expect(projectResponse(schema, { id: 1, token: SECRET })).toEqual({
      id: 1,
    });
  });

  it("keeps a union option's own fields, not another option's", () => {
    const schema = z.union([
      z.object({ kind: z.literal("user"), name: z.string() }),
      z.object({ email: z.string(), kind: z.literal("admin") }),
    ]);

    expect(
      projectResponse(schema, {
        email: SECRET,
        kind: "user",
        name: "Ann",
      } as z.output<typeof schema>),
    ).toEqual({ kind: "user", name: "Ann" });
  });

  it("fails closed when no union option accepts the projected value", () => {
    const schema = z.union([
      z.object({ kind: z.literal("a") }),
      z.object({ kind: z.literal("b") }),
    ]);

    const error = projectionError(() =>
      projectResponse(schema, { kind: SECRET } as unknown as z.output<
        typeof schema
      >),
    );

    expect(error.message).toContain("no union option");
    expect(error.message).not.toContain(SECRET);
  });

  it("refuses a class instance where an object is declared", () => {
    class Row {
      id = 1;
      passwordHash = SECRET;
    }

    const error = projectionError(() =>
      projectResponse(z.object({ id: z.number() }), new Row()),
    );

    expect(error.reason).toBe("response: expected a plain object");
  });

  it("accepts an object without a prototype", () => {
    const value = Object.assign(Object.create(null) as object, {
      id: 1,
      token: SECRET,
    });

    expect(
      projectResponse(z.object({ id: z.number() }), value as { id: number }),
    ).toEqual({ id: 1 });
  });

  it.each([
    ["a transform", z.object({ id: z.string().transform(Number) })],
    ["a default", z.object({ id: z.number().default(1) })],
    ["a pipe", z.object({ id: z.string().pipe(z.string()) })],
  ])("refuses %s without echoing the value", (_, schema) => {
    const error = projectionError(() =>
      projectResponse(schema as z.ZodType, { id: SECRET }),
    );

    expect(error.reason).toMatch(/^response\.id: "\w+" schemas cannot be/);
    expect(error.message).not.toContain(SECRET);
  });

  it("refuses an async schema without echoing the value", () => {
    const schema = z.object({
      id: z.string().refine(async () => await Promise.resolve(true)),
    });

    const error = projectionError(() =>
      projectResponse(schema, { id: SECRET }),
    );

    expect(error.reason).toBe("response: async schemas cannot be projected");
    expect(error.message).not.toContain(SECRET);
  });

  it("names the path of a value that does not match, not the value", () => {
    const error = projectionError(() =>
      projectResponse(z.object({ id: z.number() }), {
        id: SECRET,
      } as unknown as { id: number }),
    );

    expect(error.reason).toBe("response.id: invalid_type (expected number)");
  });
});

describe("respondJson", () => {
  it("keeps the status and headers set on the context", async () => {
    const schema = z.object({ id: z.number() });
    const app = new Hono().get("/", c => {
      c.header("x-trace", "abc");

      return respondJson(c, 201, schema, {
        id: 1,
        passwordHash: SECRET,
      } as z.output<typeof schema>);
    });

    const response = await app.request("/");

    expect(response.status).toBe(201);
    expect(response.headers.get("x-trace")).toBe("abc");
    expect(await response.json()).toEqual({ id: 1 });
  });
});
