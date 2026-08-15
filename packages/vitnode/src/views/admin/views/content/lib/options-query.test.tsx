import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import {
  contentOptionsQueryKey,
  useInvalidateContentOptions,
} from "./options-query";

const reference = (
  overrides: Partial<ContentFormFieldSpec>,
): ContentFormFieldSpec => ({
  kind: "relation",
  label: "Categories",
  multiple: true,
  name: "categoryId",
  nullable: false,
  required: false,
  ...overrides,
});

describe("contentOptionsQueryKey", () => {
  it("keys a relation by what it offers before what it is called", () => {
    expect(
      contentOptionsQueryKey(
        reference({ targetContentTypeId: "blog.category" }),
      ),
    ).toEqual(["content-options", "blog.category", "categoryId"]);
  });

  it("gives two fields onto the same target a shared prefix", () => {
    const [primary, secondary] = [
      contentOptionsQueryKey(
        reference({ name: "categoryId", targetContentTypeId: "blog.category" }),
      ),
      contentOptionsQueryKey(
        reference({ name: "relatedId", targetContentTypeId: "blog.category" }),
      ),
    ];

    // The prefix is what one invalidation matches; the field name on the end is
    // what keeps two pickers searching independently.
    expect(primary.slice(0, 2)).toEqual(secondary.slice(0, 2));
    expect(primary).not.toEqual(secondary);
  });

  it("puts a user field in a bucket no content type can name", () => {
    // People are not a content type, so no content mutation should ever expire
    // the authors picker.
    expect(contentOptionsQueryKey(reference({ kind: "user" }))).toEqual([
      "content-options",
      "core.users",
      "categoryId",
    ]);
  });
});

describe("useInvalidateContentOptions", () => {
  const cached = (client: QueryClient, key: unknown[]) =>
    client.getQueryData(key);

  const renderInvalidate = (client: QueryClient) => {
    let invalidate: (contentTypeId: string) => void = () => undefined;

    const Probe = () => {
      invalidate = useInvalidateContentOptions();

      return null;
    };

    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );

    return (contentTypeId: string) => {
      invalidate(contentTypeId);
    };
  };

  it("drops every picker that offers rows of the mutated content type", () => {
    const client = new QueryClient();
    const categories = ["content-options", "blog.category", "categoryId", {}];
    const authors = ["content-options", "core.users", "authorId", {}];

    client.setQueryData(categories, [{ label: "News", value: "1" }]);
    client.setQueryData(authors, [{ label: "Ada", value: "1" }]);

    renderInvalidate(client)("blog.category");

    // Removed rather than marked stale: with `refetchOnMount: false` a stale
    // entry is still served, so the article form would open on the old list.
    expect(cached(client, categories)).toBeUndefined();
    // A category is not a person. Expiring the authors picker too would be a
    // second request on every category edit for a list that did not move.
    expect(cached(client, authors)).toEqual([{ label: "Ada", value: "1" }]);
  });

  it("leaves the rest of the AdminCP's cache alone", () => {
    const client = new QueryClient();
    const unrelated = ["admin-users", { search: "" }];

    client.setQueryData(unrelated, ["something else"]);
    client.setQueryData(["content-options", "blog.category", "categoryId"], []);

    renderInvalidate(client)("blog.category");

    // The namespace is why this is safe to call on every save: one client backs
    // the whole AdminCP, and a broader match would take its lists with it.
    expect(cached(client, unrelated)).toEqual(["something else"]);
  });
});
