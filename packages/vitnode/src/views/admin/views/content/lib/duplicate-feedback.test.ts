// @vitest-environment node
import { describe, expect, it } from "vitest";

import { contentDuplicateErrorMessage } from "./duplicate-feedback";

const LABELS: Record<string, string> = {
  friendlyUrl: "Friendly URL",
  isbn: "ISBN",
  sku: "SKU",
};

const labelField = (name: string) => LABELS[name] ?? name;

describe("contentDuplicateErrorMessage", () => {
  it("names the slug field by its label, with the slug that ran out", () => {
    expect(
      contentDuplicateErrorMessage(
        {
          code: "CONTENT_DUPLICATE_SLUG_CONFLICT",
          contentTypeId: "blog.post",
          field: "friendlyUrl",
          locale: "en",
          slug: "hello-world-copy",
        },
        { labelField },
      ),
    ).toEqual({
      key: "slug_conflict",
      values: { field: "Friendly URL", slug: "hello-world-copy" },
    });
  });

  it("lists every unique field that needs a new value, by label", () => {
    expect(
      contentDuplicateErrorMessage(
        {
          code: "CONTENT_DUPLICATE_UNIQUE_REQUIRED",
          contentTypeId: "shop.product",
          fields: ["sku", "isbn"],
        },
        { labelField, list: names => names.join(" and ") },
      ),
    ).toEqual({
      key: "unique_required",
      values: { count: 2, fields: "SKU and ISBN" },
    });
  });

  it("leaves every other refusal to the shared error sentence", () => {
    expect(contentDuplicateErrorMessage(undefined, { labelField })).toBeNull();
  });
});
