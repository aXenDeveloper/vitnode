import { describe, expect, it } from "vitest";

import type {
  ContentContainerPolicy,
  ContentContainerPolicyOverrides,
  ResolvedContentContainerPolicies,
} from "./policies";

import { ContentEngineError } from "../errors";
import {
  contentAuthorMayEdit,
  contentContainerPolicyFallback,
  DISABLED_CONTENT_CONTAINER_POLICIES,
  readContentContainerPolicyOverrides,
  resolveContentContainerPolicies,
  resolveContentContainerPolicy,
} from "./policies";

const REPLY = "forum.reply";
const TOPIC = "forum.topic";

const FALLBACK: ContentContainerPolicy = {
  authorEdit: "always",
  authorEditMinutes: 60,
  create: "members",
  edits: "immediate",
  publish: "immediate",
};

describe("resolveContentContainerPolicies", () => {
  it.each([undefined, false] as const)(
    "turns policies off when they are %s",
    policies => {
      expect(resolveContentContainerPolicies("forum.forums", policies)).toBe(
        DISABLED_CONTENT_CONTAINER_POLICIES,
      );
    },
  );

  it("turns policies on with nothing decided for an empty object", () => {
    expect(resolveContentContainerPolicies("forum.forums", {})).toEqual({
      contentTypes: {},
      defaults: {},
      enabled: true,
    });
  });

  it("keeps the declared values and never stores an undefined one", () => {
    const resolved = resolveContentContainerPolicies("forum.forums", {
      contentTypes: {
        [REPLY]: { authorEdit: "window", authorEditMinutes: 15 },
      },
      defaults: { edits: undefined, publish: "approve" },
    });

    expect(resolved).toEqual({
      contentTypes: {
        [REPLY]: { authorEdit: "window", authorEditMinutes: 15 },
      },
      defaults: { publish: "approve" },
      enabled: true,
    });
    expect(Object.hasOwn(resolved.defaults, "edits")).toBe(false);
  });

  it.each<[string, unknown, RegExp]>([
    ["an array", [], /policies is an object/],
    ["a string", "approve", /policies is an object/],
    ["an unknown option", { rules: {} }, /policies\.rules is not an option/],
    [
      "a content type key that is not an id",
      { contentTypes: { Reply: {} } },
      /has the key "Reply", which is not a content type id/,
    ],
    [
      "an unknown policy key in defaults",
      { defaults: { moderate: true } },
      /policies\.defaults\.moderate is not a policy/,
    ],
    [
      "an unknown policy key for a content type",
      { contentTypes: { [REPLY]: { approve: true } } },
      /policies\.contentTypes\["forum\.reply"\]\.approve is not a policy/,
    ],
    [
      "an unknown publish mode",
      { defaults: { publish: "later" } },
      /policies\.defaults\.publish is not valid/,
    ],
    [
      "an unknown create audience",
      { defaults: { create: "everyone" } },
      /policies\.defaults\.create is not valid/,
    ],
    [
      "an unknown authorEdit",
      { contentTypes: { [REPLY]: { authorEdit: "sometimes" } } },
      /policies\.contentTypes\["forum\.reply"\]\.authorEdit is not valid/,
    ],
    [
      "a zero-minute window",
      { defaults: { authorEditMinutes: 0 } },
      /policies\.defaults\.authorEditMinutes is not valid/,
    ],
    [
      "a fractional window",
      { defaults: { authorEditMinutes: 1.5 } },
      /policies\.defaults\.authorEditMinutes is not valid/,
    ],
    [
      "a window longer than a year",
      { defaults: { authorEditMinutes: 60 * 24 * 365 + 1 } },
      /policies\.defaults\.authorEditMinutes is not valid/,
    ],
  ])("rejects %s", (_label, policies, message) => {
    const resolve = () =>
      resolveContentContainerPolicies("forum.forums", policies as never);

    expect(resolve).toThrow(ContentEngineError);
    expect(resolve).toThrow(message);
  });
});

describe("contentContainerPolicyFallback", () => {
  it.each([
    ["published", "immediate"],
    ["draft", "approve"],
  ] as const)(
    "publishes a %s create %s, and lets owners edit forever",
    (status, publish) => {
      expect(
        contentContainerPolicyFallback({
          publicWrite: { create: { status } },
        } as never),
      ).toEqual({ ...FALLBACK, publish });
    },
  );
});

describe("resolveContentContainerPolicy", () => {
  const enabled = (
    policies: Partial<ResolvedContentContainerPolicies> = {},
  ): ResolvedContentContainerPolicies => ({
    contentTypes: {},
    defaults: {},
    enabled: true,
    ...policies,
  });

  const resolve = (
    chain: { id: number; policies: ContentContainerPolicyOverrides }[],
    policies = enabled(),
    contentTypeId = REPLY,
  ) =>
    resolveContentContainerPolicy({
      chain,
      contentTypeId,
      fallback: FALLBACK,
      policies,
    });

  it("is the fallback when nothing decides", () => {
    expect(resolve([{ id: 1, policies: {} }])).toEqual({
      policy: FALLBACK,
      sources: {
        authorEdit: { kind: "fallback" },
        authorEditMinutes: { kind: "fallback" },
        create: { kind: "fallback" },
        edits: { kind: "fallback" },
        publish: { kind: "fallback" },
      },
    });
  });

  it("decides every key on its own, nearest layer first, and says where each came from", () => {
    const effective = resolve(
      [
        { id: 3, policies: { [REPLY]: { create: "moderators" } } },
        { id: 2, policies: { [REPLY]: { publish: "approve" } } },
        {
          id: 1,
          policies: { [REPLY]: { edits: "approve", publish: "immediate" } },
        },
      ],
      enabled({
        contentTypes: { [REPLY]: { authorEdit: "window", edits: "immediate" } },
        defaults: { authorEdit: "never", authorEditMinutes: 30 },
      }),
    );

    expect(effective).toEqual({
      policy: {
        authorEdit: "window",
        authorEditMinutes: 30,
        create: "moderators",
        edits: "approve",
        publish: "approve",
      },
      sources: {
        authorEdit: { kind: "contentType" },
        authorEditMinutes: { kind: "default" },
        create: { containerId: 3, kind: "container" },
        edits: { containerId: 1, kind: "container" },
        publish: { containerId: 2, kind: "container" },
      },
    });
  });

  it("treats an explicit `never` as an override, not as nothing", () => {
    const effective = resolve(
      [
        { id: 2, policies: { [REPLY]: { authorEdit: "never" } } },
        { id: 1, policies: { [REPLY]: { authorEdit: "window" } } },
      ],
      enabled({ defaults: { authorEdit: "always" } }),
    );

    expect(effective.policy.authorEdit).toBe("never");
    expect(effective.sources.authorEdit).toEqual({
      containerId: 2,
      kind: "container",
    });
  });

  it("inherits a key the container leaves absent or undefined", () => {
    const effective = resolve([
      { id: 2, policies: { [REPLY]: { publish: undefined } } },
      { id: 1, policies: { [REPLY]: { publish: "approve" } } },
    ]);

    expect(effective.policy.publish).toBe("approve");
    expect(effective.sources.publish).toEqual({
      containerId: 1,
      kind: "container",
    });
  });

  it("keeps the overrides of different content types in one container apart", () => {
    const chain = [
      {
        id: 1,
        policies: {
          [REPLY]: { authorEdit: "window" },
          [TOPIC]: { publish: "approve" },
        } satisfies ContentContainerPolicyOverrides,
      },
    ];
    const policies = enabled({
      contentTypes: { [TOPIC]: { create: "moderators" } },
    });

    expect(resolve(chain, policies, TOPIC).policy).toEqual({
      ...FALLBACK,
      create: "moderators",
      publish: "approve",
    });
    expect(resolve(chain, policies, REPLY).policy).toEqual({
      ...FALLBACK,
      authorEdit: "window",
    });
  });
});

describe("contentAuthorMayEdit", () => {
  const NOW = new Date("2026-10-13T12:00:00.000Z");
  const ago = (milliseconds: number) => new Date(NOW.getTime() - milliseconds);
  const timed = { authorEdit: "window", authorEditMinutes: 60 } as const;

  it.each<[string, Parameters<typeof contentAuthorMayEdit>, boolean]>([
    [
      "always, whenever it was created",
      [{ ...timed, authorEdit: "always" }, null, NOW],
      true,
    ],
    [
      "never, even right after creating it",
      [{ ...timed, authorEdit: "never" }, NOW, NOW],
      false,
    ],
    ["inside the window", [timed, ago(60 * 60_000 - 1), NOW], true],
    ["the moment the window closes", [timed, ago(60 * 60_000), NOW], false],
    ["after the window", [timed, ago(61 * 60_000), NOW], false],
    ["a window with no createdAt", [timed, null, NOW], false],
    ["a window with an undefined createdAt", [timed, undefined, NOW], false],
  ])("%s", (_label, args, expected) => {
    expect(contentAuthorMayEdit(...args)).toBe(expected);
  });
});

describe("readContentContainerPolicyOverrides", () => {
  it.each([null, undefined, "x", 5, [{ publish: "approve" }]])(
    "reads %j as no overrides",
    value => {
      expect(readContentContainerPolicyOverrides(value)).toEqual({});
    },
  );

  it("keeps valid entries and drops the invalid ones", () => {
    expect(
      readContentContainerPolicyOverrides({
        [REPLY]: { authorEdit: "window", authorEditMinutes: 10 },
        [TOPIC]: { publish: "approve" },
        "forum.legacy": { publish: "later" },
        "forum.renamed": { moderate: true },
        "forum.broken": "approve",
      }),
    ).toEqual({
      [REPLY]: { authorEdit: "window", authorEditMinutes: 10 },
      [TOPIC]: { publish: "approve" },
    });
  });
});
