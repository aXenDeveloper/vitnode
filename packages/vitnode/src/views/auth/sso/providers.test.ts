import { describe, expect, it } from "vitest";

import { normalizeSSOProviders } from "./providers";

describe("normalising the SSO provider list", () => {
  it("keeps well-formed providers in the order they were registered", () => {
    expect(
      normalizeSSOProviders([
        { id: "google", name: "Google" },
        { id: "github", name: "GitHub" },
      ]),
    ).toEqual([
      { id: "google", name: "Google" },
      { id: "github", name: "GitHub" },
    ]);
  });

  it("answers with an empty list when there is nothing to render", () => {
    // A deployment with no adapters, and a loader that has not resolved: the
    // button row renders nothing for both, rather than throwing on `.map`.
    expect(normalizeSSOProviders([])).toEqual([]);
    expect(normalizeSSOProviders(undefined)).toEqual([]);
    expect(normalizeSSOProviders(null)).toEqual([]);
    expect(normalizeSSOProviders({ sso: [] })).toEqual([]);
  });

  it("drops entries that cannot become a button", () => {
    expect(
      normalizeSSOProviders([
        { id: "google", name: "Google" },
        { id: "", name: "Nameless" },
        { id: "github" },
        { name: "GitHub" },
        "google",
        null,
      ]),
    ).toEqual([{ id: "google", name: "Google" }]);
  });

  it("keeps the first of two providers sharing an id", () => {
    // React keys the row by id, so a duplicate is a warning plus a button that
    // cannot be told apart from the one above it.
    expect(
      normalizeSSOProviders([
        { id: "google", name: "Google" },
        { id: "google", name: "Google (staging)" },
      ]),
    ).toEqual([{ id: "google", name: "Google" }]);
  });
});
