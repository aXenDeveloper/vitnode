// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentRowActionInput } from "./row-actions-model";

import {
  CONTENT_ROW_ACTION_IDS,
  CONTENT_ROW_INLINE_ACTION_LIMIT,
  contentRowActionIds,
  contentRowActionsAreInline,
  isDestructiveContentRowAction,
} from "./row-actions-model";

/**
 * Which actions one content row offers.
 *
 * Two things go wrong here and they fail in opposite directions, which is why
 * this is tested rather than read: offer an action the API refuses and the
 * control looks broken; hide one the administrator holds and a feature silently
 * does not exist. Both AdminCPs read this function, so a difference between them
 * would be a difference nobody could see from either screen.
 */

/** Everything on, everything permitted - the widest row there is. */
const everything: ContentRowActionInput = {
  canDelete: true,
  canPublish: true,
  canView: true,
  delivery: true,
  editorial: true,
  preview: true,
  scheduling: true,
};

const nothing: ContentRowActionInput = {
  canDelete: false,
  canPublish: false,
  canView: false,
  delivery: false,
  editorial: false,
  preview: false,
  scheduling: false,
};

describe("contentRowActionIds", () => {
  it("offers every action a content type enabled, in declaration order", () => {
    expect(contentRowActionIds(everything)).toEqual([
      "preview",
      "schedule",
      "history",
      "delivery",
      "delete",
    ]);
  });

  it("offers nothing for a Stage 1 content type with no permissions", () => {
    expect(contentRowActionIds(nothing)).toEqual([]);
  });

  it("puts the destructive one last, where a mis-click does not land", () => {
    expect(contentRowActionIds(everything).at(-1)).toBe("delete");
    expect(CONTENT_ROW_ACTION_IDS.at(-1)).toBe("delete");
  });

  describe("the feature has to be enabled", () => {
    it.each([
      ["preview", { preview: false }],
      ["schedule", { scheduling: false }],
      ["history", { editorial: false }],
      ["delivery", { delivery: false }],
    ] as const)(
      "drops %s when the content type did not enable it",
      (id, off) => {
        expect(contentRowActionIds({ ...everything, ...off })).not.toContain(
          id,
        );
      },
    );

    it("always offers delete, which every content type has", () => {
      expect(contentRowActionIds({ ...nothing, canDelete: true })).toEqual([
        "delete",
      ]);
    });
  });

  describe("the permission has to be held", () => {
    it("hides everything readable from an administrator without can_view", () => {
      expect(contentRowActionIds({ ...everything, canView: false })).toEqual([
        "schedule",
        "delete",
      ]);
    });

    it("gates scheduling on can_publish, because scheduling is publishing", () => {
      expect(
        contentRowActionIds({ ...everything, canPublish: false }),
      ).not.toContain("schedule");
      // …and it needs nothing else: a can_publish-only administrator still
      // schedules.
      expect(
        contentRowActionIds({ ...nothing, canPublish: true, scheduling: true }),
      ).toEqual(["schedule"]);
    });

    it("gates delete on can_delete alone", () => {
      expect(
        contentRowActionIds({ ...everything, canDelete: false }),
      ).not.toContain("delete");
    });
  });

  describe("renderable", () => {
    it("offers everything when the host does not narrow it", () => {
      expect(contentRowActionIds(everything)).toEqual(
        contentRowActionIds({
          ...everything,
          renderable: [...CONTENT_ROW_ACTION_IDS],
        }),
      );
    });

    it("does not offer an action whose panel this host cannot open", () => {
      // A menu entry that opens nothing is worse than an absent one.
      expect(
        contentRowActionIds({
          ...everything,
          renderable: ["delete", "history"],
        }),
      ).toEqual(["history", "delete"]);
    });

    it("cannot re-add an action the permissions or the features refused", () => {
      expect(
        contentRowActionIds({
          ...nothing,
          renderable: [...CONTENT_ROW_ACTION_IDS],
        }),
      ).toEqual([]);
    });
  });
});

describe("contentRowActionsAreInline", () => {
  it("renders up to the limit as buttons", () => {
    expect(contentRowActionsAreInline(1)).toBe(true);
    expect(contentRowActionsAreInline(CONTENT_ROW_INLINE_ACTION_LIMIT)).toBe(
      true,
    );
  });

  it("collapses past it into the menu", () => {
    expect(
      contentRowActionsAreInline(CONTENT_ROW_INLINE_ACTION_LIMIT + 1),
    ).toBe(false);
  });

  it("is false for none, so nothing renders a menu with nothing in it", () => {
    expect(contentRowActionsAreInline(0)).toBe(false);
  });

  it("collapses the widest row, which is what the limit is for", () => {
    expect(
      contentRowActionsAreInline(contentRowActionIds(everything).length),
    ).toBe(false);
  });
});

describe("isDestructiveContentRowAction", () => {
  it("names delete and nothing else", () => {
    expect(
      CONTENT_ROW_ACTION_IDS.filter(isDestructiveContentRowAction),
    ).toEqual(["delete"]);
  });
});
