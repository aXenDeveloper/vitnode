import { describe, expect, it } from "vitest";

import type { ContentDrafts } from "@/content/live/http";

import {
  contentDraftDiffers,
  mergeContentDraft,
  overlayContentDrafts,
} from "./values";

const draft = (values: Record<string, unknown>) => ({
  baseVersion: 1,
  updatedAt: "2026-10-08T12:00:00.000Z",
  updatedBy: { id: 2, name: "Anna" },
  values,
});

const drafts: ContentDrafts = {
  shared: draft({ featured: true }),
  translations: {
    de: draft({ title: "Hallo" }),
    pl: draft({ title: "Cześć" }),
  },
};

const record = { featured: false, id: 7, labels: {} };
const translations = [
  { locale: "en", values: { body: "Body", title: "Hello" } },
  { locale: "pl", values: { body: "Treść", title: "Witaj" } },
];

describe("overlayContentDrafts", () => {
  it("opens the form on the draft, shared and per language", () => {
    const overlaid = overlayContentDrafts(record, translations, drafts);

    expect(overlaid.data).toMatchObject({ featured: true, id: 7 });
    expect(overlaid.translations).toEqual([
      { locale: "en", values: { body: "Body", title: "Hello" } },
      { locale: "pl", values: { body: "Treść", title: "Cześć" } },
      { locale: "de", values: { title: "Hallo" } },
    ]);
  });

  it("leaves the committed record alone", () => {
    overlayContentDrafts(record, translations, drafts);

    expect(record.featured).toBe(false);
    expect(translations[1]?.values.title).toBe("Witaj");
  });
});

describe("contentDraftDiffers", () => {
  it("is true while the draft holds what the record does not", () => {
    expect(contentDraftDiffers(record, translations, drafts)).toBe(true);
  });

  it("is false once Save committed the drafted values", () => {
    expect(
      contentDraftDiffers(
        { ...record, featured: true },
        [
          ...translations.slice(0, 1),
          { locale: "pl", values: { body: "Treść", title: "Cześć" } },
          { locale: "de", values: { title: "Hallo" } },
        ],
        drafts,
      ),
    ).toBe(false);
  });
});

describe("mergeContentDraft", () => {
  it("folds a change into the language it belongs to", () => {
    const merged = mergeContentDraft(drafts, {
      by: { id: 3, name: "Ben" },
      locale: "pl",
      updatedAt: "2026-10-08T12:01:00.000Z",
      values: { body: "Nowa treść" },
    });

    expect(merged.translations.pl).toEqual({
      baseVersion: 1,
      updatedAt: "2026-10-08T12:01:00.000Z",
      updatedBy: { id: 3, name: "Ben" },
      values: { body: "Nowa treść", title: "Cześć" },
    });
    expect(merged.shared).toBe(drafts.shared);
  });
});
