import type {
  AutoTranslateFieldResult,
  AutoTranslateResponse,
} from "@vitnode/api/content/auto-translate";

import { describe, expect, it, vi } from "vitest";

import type { AutoTranslateItemRequest } from "./query";

import { autoTranslateItemKey, AutoTranslateStore } from "./store";

const TOPIC = "@vitnode/forum:topic";
const OLD = "0".repeat(64);
const NEW = "1".repeat(64);
const TITLE = "2".repeat(64);
const ITEM = autoTranslateItemKey(TOPIC, 7);

const target = (
  fields: { fingerprint: string; name: string }[] = [
    { fingerprint: NEW, name: "body" },
  ],
): AutoTranslateItemRequest => ({ contentTypeId: TOPIC, fields, id: 7 });

const response = (
  locale: string,
  fields: AutoTranslateFieldResult[],
  id = "7",
): AutoTranslateResponse => ({
  items: [{ contentTypeId: TOPIC, fields, id }],
  locale,
});

const ready = (
  fingerprint: null | string,
  value = "Hello everyone",
): AutoTranslateFieldResult => ({
  fingerprint,
  name: "body",
  state: "ready",
  value,
});

describe("AutoTranslateStore.ingest", () => {
  it("keeps an answer under the language it was given in", () => {
    const store = new AutoTranslateStore();

    // A late answer for the language the reader just left.
    store.ingest(response("de", [ready(NEW, "Hallo zusammen")]), [target()]);
    store.ingest(response("en", [ready(NEW)]), [target()]);

    expect(store.get("en", ITEM, "body", NEW)?.value).toBe("Hello everyone");
    expect(store.get("de", ITEM, "body", NEW)?.value).toBe("Hallo zusammen");
    expect(store.get("pl", ITEM, "body", NEW)).toBeUndefined();
  });

  it("drops an answer for a version of the text the page did not ask about", () => {
    const store = new AutoTranslateStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.ingest(response("en", [ready(OLD)]), [target()]);

    expect(store.get("en", ITEM, "body", NEW)).toBeUndefined();
    expect(store.get("en", ITEM, "body", OLD)).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it.each<[string, AutoTranslateResponse]>([
    ["another record", response("en", [ready(NEW)], "8")],
    [
      "a field the page did not ask for",
      response("en", [{ ...ready(NEW), name: "title" }]),
    ],
  ])("ignores %s", (_case, answer) => {
    const store = new AutoTranslateStore();

    store.ingest(answer, [target()]);

    expect(store.getVersion()).toBe(0);
  });

  it.each<[string, AutoTranslateFieldResult]>([
    ["stale", { fingerprint: OLD, name: "body", state: "stale" }],
    [
      "unreadable",
      {
        fingerprint: null,
        name: "body",
        reason: "not_found",
        state: "unavailable",
      },
    ],
  ])(
    "stores a %s answer under the asked fingerprint, which never carries a value",
    (_case, result) => {
      const store = new AutoTranslateStore();

      store.ingest(response("en", [result]), [target()]);

      expect(store.get("en", ITEM, "body", NEW)).toEqual(result);
    },
  );

  it("does not take a ready value whose fingerprint is null", () => {
    const store = new AutoTranslateStore();

    store.ingest(response("en", [ready(null)]), [target()]);

    expect(store.get("en", ITEM, "body", NEW)).toBeUndefined();
  });
});

describe("AutoTranslateStore.claimMissing", () => {
  it("hands each field version out once per language until released", () => {
    const store = new AutoTranslateStore();

    expect(store.claimMissing("en", target())).toEqual(target());
    expect(store.claimMissing("en", target())).toBeNull();
    expect(store.claimMissing("pl", target())).toEqual(target());
    // An edit is a new version, asked for again.
    expect(
      store.claimMissing("en", target([{ fingerprint: OLD, name: "body" }])),
    ).not.toBeNull();

    store.release("en", target());

    expect(store.claimMissing("en", target())).toEqual(target());
  });

  it("claims only fields that are unanswered or answered missing", () => {
    const store = new AutoTranslateStore();
    const both = target([
      { fingerprint: TITLE, name: "title" },
      { fingerprint: NEW, name: "body" },
    ]);
    store.ingest(
      response("en", [
        { fingerprint: TITLE, name: "title", state: "original" },
        { fingerprint: NEW, name: "body", state: "missing" },
      ]),
      [both],
    );

    expect(store.claimMissing("en", both)).toEqual(
      target([{ fingerprint: NEW, name: "body" }]),
    );

    store.release("en", both);
    store.ingest(response("en", [ready(NEW)]), [both]);

    expect(store.claimMissing("en", both)).toBeNull();
  });
});

describe("AutoTranslateStore reader choices", () => {
  it("tracks pending fields of the asked version only", () => {
    const store = new AutoTranslateStore();
    store.ingest(
      response("en", [{ fingerprint: NEW, name: "body", state: "pending" }]),
      [target()],
    );

    expect(store.isPending("en", target())).toBe(true);
    expect(store.isPending("pl", target())).toBe(false);
    expect(
      store.isPending("en", target([{ fingerprint: OLD, name: "body" }])),
    ).toBe(false);
  });

  it("keeps a manual Translate per language and per item, and it ends show-original", () => {
    const store = new AutoTranslateStore();
    const other = autoTranslateItemKey(TOPIC, 8);
    const listener = vi.fn();
    store.subscribe(listener);

    store.setShowingOriginal(ITEM, true);
    expect(store.isShowingOriginal(ITEM)).toBe(true);
    expect(store.isShowingOriginal(other)).toBe(false);

    store.setManual("en", ITEM);

    expect(store.isManual("en", ITEM)).toBe(true);
    expect(store.isManual("pl", ITEM)).toBe(false);
    expect(store.isManual("en", other)).toBe(false);
    expect(store.isShowingOriginal(ITEM)).toBe(false);

    store.setShowingOriginal(ITEM, true);
    store.setShowingOriginal(ITEM, false);

    expect(store.isShowingOriginal(ITEM)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
