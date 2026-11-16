import { describe, expect, it } from "vitest";
import { z } from "zod";

import { JsonWireError, parseJsonWire, toJsonWire } from "./json-wire";

const SECRET = "hunter2-secret";

const circular = (): Record<string, unknown> => {
  const value: Record<string, unknown> = { name: SECRET };
  value.self = value;

  return value;
};

// oxlint-disable-next-line no-sparse-arrays -- the hole is the case under test
const sparse = [SECRET, , SECRET];

describe("toJsonWire", () => {
  it("copies a dense JSON value unchanged and drops undefined properties", () => {
    const value = {
      list: [1, "two", true, null, { nested: [0] }],
      missing: undefined,
      name: "note",
    };

    expect(toJsonWire(value, "payload")).toEqual({
      list: [1, "two", true, null, { nested: [0] }],
      name: "note",
    });
    expect(JSON.parse(JSON.stringify(toJsonWire(value)))).toEqual(
      toJsonWire(value),
    );
  });

  it("accepts an object without a prototype", () => {
    const value = Object.assign(Object.create(null) as object, { id: 1 });

    expect(toJsonWire(value)).toEqual({ id: 1 });
  });

  it.each([
    ["a sparse array", { items: sparse }, "payload.items[1]"],
    ["an undefined array item", { items: [1, undefined] }, "payload.items[1]"],
    ["a Date", { at: new Date() }, "payload.at"],
    ["NaN", { score: Number.NaN }, "payload.score"],
    ["Infinity", { score: Number.POSITIVE_INFINITY }, "payload.score"],
    ["a bigint", { id: 1n }, "payload.id"],
    ["a Map", { lookup: new Map([[SECRET, SECRET]]) }, "payload.lookup"],
    ["a circular reference", { node: circular() }, "payload.node.self"],
    ["an odd key", { "a b": new Date() }, 'payload["a b"]'],
  ])("rejects %s, naming only the path", (_, value, path) => {
    let thrown: unknown;
    try {
      toJsonWire(value, "payload");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(JsonWireError);
    expect((thrown as JsonWireError).path).toBe(path);
    expect((thrown as JsonWireError).message.startsWith(`${path} `)).toBe(true);
    expect((thrown as JsonWireError).message).not.toContain(SECRET);
  });

  it("allows the same object twice when it is not its own ancestor", () => {
    const shared = { id: 1 };

    expect(toJsonWire({ a: shared, b: [shared] })).toEqual({
      a: { id: 1 },
      b: [{ id: 1 }],
    });
  });
});

describe("parseJsonWire", () => {
  it("validates the wire form and returns both the wire and the output", async () => {
    const schema = z.object({
      at: z.iso.datetime().transform(v => new Date(v)),
    });

    const parsed = await parseJsonWire(schema, {
      at: "2026-11-11T10:00:00.000Z",
    });

    expect(parsed).toEqual({
      data: { at: new Date("2026-11-11T10:00:00.000Z") },
      success: true,
      wire: { at: "2026-11-11T10:00:00.000Z" },
    });
  });

  it("reports schema issues by path and code, never by value", async () => {
    const schema = z.object({
      email: z.email({ error: `bad ${SECRET}` }),
      id: z.number(),
    });

    const parsed = await parseJsonWire(
      schema,
      { email: SECRET, id: SECRET },
      "payload",
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.reason).toBe(
      "payload.email: invalid_format; payload.id: invalid_type (expected number)",
    );
  });

  it("turns a non-JSON value into a failed result instead of throwing", async () => {
    const parsed = await parseJsonWire(z.object({}).loose(), {
      at: new Date(),
    });

    expect(parsed).toEqual({
      reason: expect.stringMatching(/^value\.at is a Date/) as unknown,
      success: false,
    });
  });
});
