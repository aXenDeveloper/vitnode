import { describe, expect, it } from "vitest";

import { groupComboboxItems } from "./combobox-groups";

describe("groupComboboxItems", () => {
  it("returns null when no option names a group", () => {
    expect(
      groupComboboxItems(
        ["a", "b"],
        [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      ),
    ).toBeNull();
  });

  it("groups values in the order their groups first appear", () => {
    expect(
      groupComboboxItems(
        ["apple", "carrot", "banana"],
        [
          { group: "Fruits", label: "Apple", value: "apple" },
          { group: "Vegetables", label: "Carrot", value: "carrot" },
          { group: "Fruits", label: "Banana", value: "banana" },
        ],
      ),
    ).toEqual([
      { items: ["apple", "banana"], value: "Fruits" },
      { items: ["carrot"], value: "Vegetables" },
    ]);
  });

  it("keeps values without a group together under an empty heading", () => {
    expect(
      groupComboboxItems(
        ["other", "apple", "unknown"],
        [
          { label: "Other", value: "other" },
          { group: "Fruits", label: "Apple", value: "apple" },
        ],
      ),
    ).toEqual([
      { items: ["other", "unknown"], value: "" },
      { items: ["apple"], value: "Fruits" },
    ]);
  });
});
