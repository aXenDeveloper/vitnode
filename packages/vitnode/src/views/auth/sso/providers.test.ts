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

  it("keeps an icon the button can render", () => {
    const markup = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>';

    expect(
      normalizeSSOProviders([
        { id: "github", name: "GitHub", icon: markup },
        { id: "slack", name: "Slack", icon: "https://cdn.example.com/s.png" },
      ]),
    ).toEqual([
      { icon: { kind: "svg", markup }, id: "github", name: "GitHub" },
      {
        icon: { kind: "image", src: "https://cdn.example.com/s.png" },
        id: "slack",
        name: "Slack",
      },
    ]);
  });

  it("drops an icon it cannot render, and keeps the provider", () => {
    expect(
      normalizeSSOProviders([
        { id: "github", name: "GitHub", icon: '<svg onload="x()"></svg>' },
        { id: "slack", name: "Slack", icon: 42 },
      ]),
    ).toEqual([
      { id: "github", name: "GitHub" },
      { id: "slack", name: "Slack" },
    ]);
  });

  it("keeps a hex brand color and drops anything else", () => {
    expect(
      normalizeSSOProviders([
        { brandColor: "#5865F2", id: "discord", name: "Discord" },
        { brandColor: " #FFF ", id: "white", name: "White" },
        { brandColor: "red", id: "named", name: "Named" },
        { brandColor: "#5865F2; background: url(x)", id: "css", name: "CSS" },
        { brandColor: 42, id: "number", name: "Number" },
      ]),
    ).toEqual([
      { brandColor: "#5865f2", id: "discord", name: "Discord" },
      { brandColor: "#fff", id: "white", name: "White" },
      { id: "named", name: "Named" },
      { id: "css", name: "CSS" },
      { id: "number", name: "Number" },
    ]);
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
