import { describe, expect, it } from "vitest";

import type { EditorDropRejection } from "../dnd/resolve-drop";

import en from "../../locales/en.json";
import {
  AREA_REJECTION_LABELS,
  DND_REJECTION_LABELS,
  ZONE_REJECTION_LABELS,
} from "./rejection-labels";

const REASONS: EditorDropRejection[] = [
  "nested-area",
  "not-allowed",
  "not-registered",
];

const resolve = (key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (at, part) =>
        typeof at === "object" && at !== null
          ? (at as Record<string, unknown>)[part]
          : undefined,
      en.core.editor,
    );

describe("every refusal the editor can show has words for it", () => {
  const records = {
    area: AREA_REJECTION_LABELS,
    dnd: DND_REJECTION_LABELS,
    zone: ZONE_REJECTION_LABELS,
  };

  for (const [where, record] of Object.entries(records)) {
    it(`covers every rejection reason in the ${where} surface`, () => {
      expect(Object.keys(record).sort()).toStrictEqual([...REASONS].sort());
    });

    it(`resolves every ${where} message in the shipped English`, () => {
      for (const reason of REASONS) {
        expect(typeof resolve(record[reason])).toBe("string");
      }
    });
  }

  it("tells a missing plugin apart from a zone that forbids the block", () => {
    expect(ZONE_REJECTION_LABELS["not-registered"]).not.toBe(
      ZONE_REJECTION_LABELS["not-allowed"],
    );
    expect(AREA_REJECTION_LABELS["not-registered"]).not.toBe(
      AREA_REJECTION_LABELS["not-allowed"],
    );
    expect(DND_REJECTION_LABELS["not-registered"]).not.toBe(
      DND_REJECTION_LABELS["not-allowed"],
    );
  });
});
