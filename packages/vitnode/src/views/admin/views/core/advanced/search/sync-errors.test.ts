import { describe, expect, it } from "vitest";

import { parseSearchSyncError } from "./sync-errors";

describe("parseSearchSyncError", () => {
  it("reads the structured payload out of a log line", () => {
    expect(
      parseSearchSyncError(
        '[content-search] {"action":"upsert","contentTypeId":"example.article","documentId":"example.article:7","error":"engine unavailable","itemId":7,"operation":"publish"}',
      ),
    ).toEqual({
      contentTypeId: "example.article",
      documentId: "example.article:7",
      message: "engine unavailable",
      operation: "publish",
    });
  });

  it("falls back to nulls for a line with no payload", () => {
    expect(
      parseSearchSyncError("[content-search] something went wrong"),
    ).toEqual({
      contentTypeId: null,
      documentId: null,
      message: null,
      operation: null,
    });
  });

  it("falls back to nulls for malformed JSON", () => {
    expect(
      parseSearchSyncError("[content-search] {not json").message,
    ).toBeNull();
  });

  it("ignores non-string values", () => {
    expect(
      parseSearchSyncError('[content-search] {"contentTypeId":7,"error":""}'),
    ).toEqual({
      contentTypeId: null,
      documentId: null,
      message: null,
      operation: null,
    });
  });
});
