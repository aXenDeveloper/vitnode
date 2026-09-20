import { describe, expect, it } from "vitest";

import {
  autofillNavigationIcon,
  autofillNavigationText,
  prefillNavigationText,
  stripDefaultNavigationText,
} from "./navigation-form-texts";

describe("prefillNavigationText", () => {
  it("shows the stored overrides when there are any", () => {
    expect(
      prefillNavigationText({
        fallback: "Discover",
        locale: "pl",
        stored: [{ languageCode: "en", value: "Explore" }],
      }),
    ).toEqual([{ languageCode: "en", value: "Explore" }]);
  });

  it("seeds the reader's language with the built-in default", () => {
    expect(
      prefillNavigationText({ fallback: "Discover", locale: "pl", stored: [] }),
    ).toEqual([{ languageCode: "pl", value: "Discover" }]);
  });

  it("stays empty for a field with no default to show", () => {
    expect(prefillNavigationText({ locale: "en", stored: [] })).toEqual([]);
    expect(
      prefillNavigationText({ fallback: "   ", locale: "en", stored: [] }),
    ).toEqual([]);
  });

  it("copies the stored entries rather than handing the row's own array to the form", () => {
    const stored = [{ languageCode: "en", value: "Explore" }];
    const prefilled = prefillNavigationText({ locale: "en", stored });

    prefilled[0].value = "Changed";

    expect(stored[0].value).toBe("Explore");
  });
});

describe("stripDefaultNavigationText", () => {
  it("drops a value the admin never changed, so the item keeps following the plugin", () => {
    expect(
      stripDefaultNavigationText({
        fallback: "Discover",
        values: [{ languageCode: "en", value: "Discover" }],
      }),
    ).toEqual([]);
  });

  it("keeps a value the admin edited", () => {
    expect(
      stripDefaultNavigationText({
        fallback: "Discover",
        values: [{ languageCode: "en", value: "Explore" }],
      }),
    ).toEqual([{ languageCode: "en", value: "Explore" }]);
  });

  it("drops blanks, so clearing the box goes back to the built-in text", () => {
    expect(
      stripDefaultNavigationText({
        fallback: "Discover",
        values: [
          { languageCode: "en", value: "   " },
          { languageCode: "pl", value: "Odkrywaj" },
        ],
      }),
    ).toEqual([{ languageCode: "pl", value: "Odkrywaj" }]);
  });

  it("keeps every language of a custom link, which has no default to compare against", () => {
    expect(
      stripDefaultNavigationText({
        values: [
          { languageCode: "en", value: "Docs" },
          { languageCode: "pl", value: "Dokumentacja" },
        ],
      }),
    ).toEqual([
      { languageCode: "en", value: "Docs" },
      { languageCode: "pl", value: "Dokumentacja" },
    ]);
  });
});

describe("autofillNavigationText", () => {
  it("fills an empty field with the page that was just picked", () => {
    expect(
      autofillNavigationText({
        locale: "en",
        nextFallback: "Search",
        values: [],
      }),
    ).toEqual([{ languageCode: "en", value: "Search" }]);
  });

  it("replaces the previous page's own words", () => {
    expect(
      autofillNavigationText({
        locale: "en",
        nextFallback: "Search",
        previousFallback: "Discover",
        values: [{ languageCode: "en", value: "Discover" }],
      }),
    ).toEqual([{ languageCode: "en", value: "Search" }]);
  });

  it("leaves anything the admin typed alone", () => {
    expect(
      autofillNavigationText({
        locale: "en",
        nextFallback: "Search",
        previousFallback: "Discover",
        values: [{ languageCode: "en", value: "Explore" }],
      }),
    ).toBeUndefined();
  });

  it("empties a field when the new page has nothing to call itself", () => {
    expect(
      autofillNavigationText({
        locale: "en",
        previousFallback: "Discover",
        values: [{ languageCode: "en", value: "Discover" }],
      }),
    ).toEqual([]);
  });

  it("treats a blank box as empty, whatever language it is in", () => {
    expect(
      autofillNavigationText({
        locale: "pl",
        nextFallback: "Szukaj",
        values: [{ languageCode: "en", value: "   " }],
      }),
    ).toEqual([{ languageCode: "pl", value: "Szukaj" }]);
  });
});

describe("autofillNavigationIcon", () => {
  it("takes the new page's icon when none was chosen", () => {
    expect(autofillNavigationIcon({ icon: "", nextIcon: "icon:search" })).toBe(
      "icon:search",
    );
  });

  it("replaces the previous page's icon", () => {
    expect(
      autofillNavigationIcon({
        icon: "icon:compass",
        nextIcon: "icon:search",
        previousIcon: "icon:compass",
      }),
    ).toBe("icon:search");
  });

  it("keeps an icon the admin picked", () => {
    expect(
      autofillNavigationIcon({
        icon: "icon:star",
        nextIcon: "icon:search",
        previousIcon: "icon:compass",
      }),
    ).toBeUndefined();
  });

  it("clears the icon when the new page ships none", () => {
    expect(
      autofillNavigationIcon({
        icon: "icon:compass",
        previousIcon: "icon:compass",
      }),
    ).toBe("");
  });
});
