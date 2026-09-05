// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CONTENT_PUBLICATION_STATUSES } from "./const";
import {
  CONTENT_DEFAULT_PUBLICATION_STATUS,
  CONTENT_PUBLICATION_ACTIONS,
  contentPublicationStatus,
  contentPublicationTransition,
  isContentPublished,
} from "./publication";

describe("reading a status off the wire", () => {
  it("keeps the two the engine declares", () => {
    for (const status of CONTENT_PUBLICATION_STATUSES) {
      expect(contentPublicationStatus(status)).toBe(status);
    }
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["a number", 1],
    ["a status from a newer API", "archived"],
    ["the right word in the wrong case", "Published"],
    ["an object", { status: "published" }],
  ])("reads %s as a draft", (_label, value) => {
    expect(contentPublicationStatus(value)).toBe(
      CONTENT_DEFAULT_PUBLICATION_STATUS,
    );
    expect(isContentPublished(value)).toBe(false);
  });

  it("defaults to the state the column defaults to", () => {
    // Not merely "some status": an unknown state must never be treated as
    // published, because that is what decides whether the row is offered a
    // control the API would refuse.
    expect(CONTENT_DEFAULT_PUBLICATION_STATUS).toBe("draft");
  });
});

describe("the transition a row is offered", () => {
  it("offers a draft the publish half", () => {
    expect(contentPublicationTransition("draft")).toEqual({
      action: "publish",
      destructive: false,
      to: "published",
    });
  });

  it("offers a published record the unpublish half", () => {
    expect(contentPublicationTransition("published")).toEqual({
      action: "unpublish",
      destructive: true,
      to: "draft",
    });
  });

  it("offers an unreadable status the publish half", () => {
    // The safe direction: publishing something already published is a `200` the
    // API answers idempotently, while offering "Unpublish" for a state nobody
    // recognises is a button whose request is refused.
    expect(contentPublicationTransition(undefined).action).toBe("publish");
  });

  it("names only actions the routes exist for", () => {
    for (const status of CONTENT_PUBLICATION_STATUSES) {
      expect(CONTENT_PUBLICATION_ACTIONS).toContain(
        contentPublicationTransition(status).action,
      );
    }
  });

  it("round-trips: applying a transition offers the other one", () => {
    const first = contentPublicationTransition("draft");
    const second = contentPublicationTransition(first.to);

    expect(second.to).toBe("draft");
    expect(second.action).not.toBe(first.action);
  });

  it("marks exactly the transition that removes a public page destructive", () => {
    // The confirmation dialog's button variant is read from this, and it is
    // carried rather than recomputed so two hosts cannot disagree about it.
    expect(contentPublicationTransition("published").destructive).toBe(true);
    expect(contentPublicationTransition("draft").destructive).toBe(false);
  });
});
