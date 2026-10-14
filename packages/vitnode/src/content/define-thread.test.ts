import { describe, expect, it } from "vitest";

import { testForumContentType } from "@/tests/content-fixtures";

import { defineContentType } from "./define";
import {
  CONTENT_THREAD_ABSOLUTE_MAX_DEPTH,
  CONTENT_THREAD_DEFAULT_MAX_DEPTH,
  DISABLED_CONTENT_THREAD,
} from "./define-thread";
import { ContentEngineError } from "./errors";
import { field } from "./fields";

const topic = () => testForumContentType;

const replyFields = {
  slug: field.slug({ generated: true }),
  body: field.text({ required: true }),
  author: field.user(),
  topic: field.relation({ target: topic, required: true }),
  parent: field.relation({ self: true, nullable: true }),
};

interface Options {
  fields?: Record<string, unknown>;
  localization?: unknown;
  publicApi?: false | Record<string, unknown>;
  publicWrite?: false | Record<string, unknown>;
  thread?: unknown;
}

const threadOf = (options: Options): unknown => {
  if (!Object.hasOwn(options, "thread"))
    return { parent: "parent", root: "topic" };
  const { thread } = options;

  return typeof thread === "object" && thread !== null
    ? { parent: "parent", root: "topic", ...thread }
    : thread;
};

const define = (options: Options = {}) => {
  const {
    fields = {},
    publicApi = {},
    publicWrite = {},
    thread: _thread,
    ...rest
  } = options;

  return defineContentType({
    id: "test.reply",
    tableName: "test_replies",
    publication: true,
    fields: { ...replyFields, ...fields },
    publicApi:
      publicApi === false
        ? undefined
        : {
            path: "replies",
            fields: ["id", "slug", "body", "topic", "parent"],
            ...publicApi,
          },
    publicWrite:
      publicWrite === false
        ? undefined
        : {
            ownership: { field: "author" },
            create: { fields: ["body", "topic", "parent"] },
            update: { fields: ["body"] },
            ...publicWrite,
          },
    thread: threadOf(options),
    ...rest,
  } as never);
};

describe("thread", () => {
  it.each([false, undefined])("is off when it is %s", thread => {
    expect(define({ thread }).thread).toEqual(DISABLED_CONTENT_THREAD);
  });

  it("resolves the fields and the default depth", () => {
    expect(define().thread).toEqual({
      enabled: true,
      maxDepth: CONTENT_THREAD_DEFAULT_MAX_DEPTH,
      parentField: "parent",
      rootField: "topic",
    });
  });

  it.each([1, CONTENT_THREAD_ABSOLUTE_MAX_DEPTH])(
    "keeps a maxDepth of %s",
    maxDepth => {
      expect(define({ thread: { maxDepth } }).thread.maxDepth).toBe(maxDepth);
    },
  );

  it.each<[string, Options, RegExp]>([
    ["a thread that is not an object", { thread: true }, /thread is `\{/],
    [
      "an unknown option",
      { thread: { depth: 3 } },
      /thread\.depth is not an option/,
    ],
    [
      "a parent that is not a relation",
      { thread: { parent: "body" } },
      /thread\.parent "body" must be a to-one/,
    ],
    [
      "a parent that points at another type",
      {
        fields: { previous: field.relation({ target: topic, nullable: true }) },
        thread: { parent: "previous" },
      },
      /thread\.parent "previous" must be a to-one/,
    ],
    [
      "a to-many parent",
      {
        fields: { answers: field.relation({ multiple: true, self: true }) },
        thread: { parent: "answers" },
      },
      /thread\.parent "answers" must be a to-one/,
    ],
    [
      "a parent that is not nullable",
      {
        fields: {
          parent: { ...replyFields.parent, nullable: false, required: true },
        },
      },
      /Self-relation "parent" is to-one but not nullable/,
    ],
    [
      "a self root",
      {
        fields: { origin: field.relation({ self: true, nullable: true }) },
        thread: { root: "origin" },
      },
      /thread\.root "origin" must be a required, to-one/,
    ],
    [
      "an optional root",
      {
        fields: { topic: field.relation({ target: topic, nullable: true }) },
      },
      /thread\.root "topic" must be a required, to-one/,
    ],
    [
      "a to-many root",
      {
        fields: { topics: field.relation({ multiple: true, target: topic }) },
        thread: { root: "topics" },
      },
      /thread\.root "topics" must be a required, to-one/,
    ],
    ...[0, -1, 1.5, CONTENT_THREAD_ABSOLUTE_MAX_DEPTH + 1].map(
      maxDepth =>
        [
          `a maxDepth of ${maxDepth}`,
          { thread: { maxDepth } },
          /thread\.maxDepth must be a whole number from 1 to 32/,
        ] as [string, Options, RegExp],
    ),
    [
      "a localized content type",
      {
        fields: { body: field.text({ localized: true, required: true }) },
        localization: { defaultLocale: "en" },
      },
      /not available on a localized content type/,
    ],
    [
      "no publicApi",
      { publicApi: false, publicWrite: false },
      /thread needs `publicApi`/,
    ],
    [
      "a parent left out of publicApi.fields",
      { publicApi: { fields: ["id", "slug", "body", "topic"] } },
      /thread uses "parent", so list it in `publicApi\.fields`/,
    ],
    [
      "a root left out of publicApi.fields",
      { publicApi: { fields: ["id", "slug", "body", "parent"] } },
      /thread uses "topic", so list it in `publicApi\.fields`/,
    ],
    [
      "a parent that public updates may move",
      { publicWrite: { update: { fields: ["body", "parent"] } } },
      /publicWrite\.update\.fields includes "parent"/,
    ],
    [
      "a root that public updates may move",
      { publicWrite: { update: { fields: ["body", "topic"] } } },
      /publicWrite\.update\.fields includes "topic"/,
    ],
  ])("rejects %s", (_label, options, message) => {
    const run = () => define(options);

    expect(run).toThrow(ContentEngineError);
    expect(run).toThrow(message);
  });
});
