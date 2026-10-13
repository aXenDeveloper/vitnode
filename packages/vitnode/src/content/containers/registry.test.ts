import { describe, expect, it } from "vitest";

import { testCategoryContentType } from "@/tests/content-fixtures";

import type { AnyContentContainerDefinition } from "./types";

import { defineContentType } from "../define";
import { ContentEngineError } from "../errors";
import { field } from "../fields";
import { defineContentContainer } from "./define";
import {
  assertContentContainerNamespaces,
  assertContentContainerReferences,
  validateContentContainers,
} from "./registry";

const boards = defineContentContainer({
  id: "test.boards",
  publicApi: { path: "boards" },
}) as AnyContentContainerDefinition;
const sections = defineContentContainer({
  id: "test.sections",
}) as AnyContentContainerDefinition;

const threadType = (container?: AnyContentContainerDefinition) =>
  defineContentType({
    id: "test.thread",
    tableName: "test_threads",
    publication: true,
    fields: {
      title: field.text({ required: true }),
      slug: field.slug({ source: "title" }),
      ...(container
        ? { board: field.container({ definition: container }) }
        : {}),
    },
    publicApi: { path: "threads", fields: ["title", "slug"] },
  });

describe("validateContentContainers", () => {
  it("returns every definition once, sorted by id", () => {
    expect(
      validateContentContainers([
        { definition: sections, pluginId: "test" },
        { definition: boards, pluginId: "test" },
        { definition: boards, pluginId: "test" },
      ]).map(({ definition }) => definition.id),
    ).toEqual(["test.boards", "test.sections"]);
  });

  it.each([
    [
      "one id from two plugins",
      [
        { definition: boards, pluginId: "test" },
        { definition: boards, pluginId: "other" },
      ],
      /Duplicate container definition id, registered by both test -> test.boards and other -> test.boards/,
    ],
    [
      "two objects with one id",
      [
        { definition: boards, pluginId: "test" },
        {
          definition: defineContentContainer({
            admin: { path: "test/other" },
            id: "test.boards",
          }),
          pluginId: "test",
        },
      ],
      /Duplicate container definition id/,
    ],
    [
      "one admin path claimed twice",
      [
        { definition: boards, pluginId: "test" },
        {
          definition: defineContentContainer({
            admin: { path: "test/boards" },
            id: "other.boards",
          }),
          pluginId: "other",
        },
      ],
      /AdminCP path "test\/boards" is claimed by both/,
    ],
    [
      "an object not built with defineContentContainer",
      [{ definition: { id: "test.boards" }, pluginId: "test" }],
      /test registers a container that was not built with `defineContentContainer`/,
    ],
    [
      "a content type",
      [{ definition: testCategoryContentType, pluginId: "test" }],
      /not built with `defineContentContainer`/,
    ],
  ])("rejects %s", (_label, entries, message) => {
    const run = () => validateContentContainers(entries as never);

    expect(run).toThrow(ContentEngineError);
    expect(run).toThrow(message);
  });
});

describe("assertContentContainerNamespaces", () => {
  const assert =
    (
      containers: AnyContentContainerDefinition[],
      contentTypes = [threadType()],
    ) =>
    () =>
      assertContentContainerNamespaces({
        containers,
        contentTypes,
        pluginId: "test",
      });

  it("accepts containers that share nothing with the content types", () => {
    expect(assert([boards, sections])).not.toThrow();
  });

  it.each([
    [
      "the permission module of a content type",
      defineContentContainer({
        admin: { permissionModule: "thread" },
        id: "test.forums",
      }),
      /Permission module "thread" is used by both test -> test.thread and test -> test.forums/,
    ],
    [
      "the permission module of another container",
      defineContentContainer({
        admin: { path: "test/forums", permissionModule: "test_boards" },
        id: "test.forums",
      }),
      /Permission module "test_boards" is used by both test -> test.boards and test -> test.forums/,
    ],
    [
      "the public path of a content type",
      defineContentContainer({
        id: "test.forums",
        publicApi: { path: "threads" },
      }),
      /Public path "threads" is claimed by both test -> test.thread and test -> test.forums/,
    ],
    [
      "the public path of a content type with the same id",
      defineContentContainer({
        id: "test.thread",
        publicApi: { path: "threads" },
      }),
      /Public path "threads" is claimed by both test -> test.thread and test -> test.thread/,
    ],
    [
      "the public path of another container",
      defineContentContainer({
        id: "test.forums",
        publicApi: { path: "boards" },
      }),
      /Public path "boards" is claimed by both test -> test.boards and test -> test.forums/,
    ],
  ])("rejects a container that takes %s", (_label, container, message) => {
    const run = assert([boards, container]);

    expect(run).toThrow(ContentEngineError);
    expect(run).toThrow(message);
  });
});

describe("assertContentContainerReferences", () => {
  const registered = [{ definition: boards, pluginId: "test" }];

  it.each([
    ["a content type without a container field", threadType()],
    ["a container field naming a registered collection", threadType(boards)],
  ])("accepts %s", (_label, contentType) => {
    expect(() =>
      assertContentContainerReferences([contentType], registered),
    ).not.toThrow();
  });

  it("rejects a container field naming a collection no plugin registers", () => {
    const run = () =>
      assertContentContainerReferences([threadType(sections)], registered);

    expect(run).toThrow(ContentEngineError);
    expect(run).toThrow(
      /Field "board" uses the container collection "test.sections", which no plugin registers/,
    );
  });
});
