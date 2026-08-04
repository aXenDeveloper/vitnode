// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CacheCall {
  fn: "revalidateTag" | "updateTag";
  profile?: unknown;
  tag: string;
}

const calls = vi.hoisted(() => [] as CacheCall[]);

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: unknown) => {
    calls.push({ fn: "revalidateTag", profile, tag });
  },
  updateTag: (tag: string) => {
    calls.push({ fn: "updateTag", tag });
  },
}));

const { revalidateContent } = await import("./revalidate.server");

const published = {
  contentTypeId: "test.post",
  id: 7,
  isPublic: true,
  slugs: ["hello"],
  wasPublic: true,
};

const functionsCalled = () => [...new Set(calls.map(call => call.fn))];

beforeEach(() => {
  calls.length = 0;
});

describe("mode", () => {
  it("expires immediately by default", () => {
    // The default protects the mutations that remove something. A caller that
    // knows its response is still safe to serve opts out explicitly.
    revalidateContent(published);

    expect(functionsCalled()).toEqual(["updateTag"]);
  });

  it("uses updateTag for `immediate`", () => {
    revalidateContent(published, { mode: "immediate" });

    expect(calls.map(call => call.tag)).toEqual([
      "content:test.post:list",
      "content:test.post:item:7",
      "content:test.post:slug:hello",
    ]);
    expect(functionsCalled()).toEqual(["updateTag"]);
  });

  it("uses revalidateTag with the `max` profile for stale-while-revalidate", () => {
    revalidateContent(published, { mode: "stale-while-revalidate" });

    expect(functionsCalled()).toEqual(["revalidateTag"]);
    // The two-argument form: without a profile this is the deprecated legacy
    // behaviour, which is `updateTag` by another name.
    expect(calls.every(call => call.profile === "max")).toBe(true);
  });
});

describe("what it touches", () => {
  it("calls nothing at all when there are no tags", () => {
    revalidateContent({ ...published, isPublic: false, wasPublic: false });

    expect(calls).toEqual([]);
  });

  it("never reaches another content type", () => {
    revalidateContent(published);

    expect(calls.every(call => call.tag.startsWith("content:test.post:"))).toBe(
      true,
    );
  });

  it("expires both slugs when a row moved", () => {
    revalidateContent({ ...published, slugs: ["old", "new"] });

    expect(calls.map(call => call.tag)).toContain("content:test.post:slug:old");
    expect(calls.map(call => call.tag)).toContain("content:test.post:slug:new");
  });
});
