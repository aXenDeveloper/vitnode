import { describe, expect, it } from "vitest";

import {
  digitFaceOffset,
  formattedPlaces,
  numberPlaces,
} from "./sliding-number-utils";

describe("digitFaceOffset", () => {
  it("puts the current digit in view and its neighbours above and below", () => {
    expect(digitFaceOffset(3, 3)).toBe(0);
    expect(digitFaceOffset(4, 3)).toBe(1);
    expect(digitFaceOffset(2, 3)).toBe(-1);
  });

  it("wraps around so 9 sits right above 0", () => {
    expect(digitFaceOffset(9, 10)).toBe(-1);
    expect(digitFaceOffset(0, 9)).toBe(1);
  });

  it("follows the rolled value between two digits", () => {
    expect(digitFaceOffset(1, 0.5)).toBeCloseTo(0.5);
  });
});

describe("numberPlaces", () => {
  it("lists one place per digit, biggest first", () => {
    expect(numberPlaces(0).exponents).toEqual([0]);
    expect(numberPlaces(7).exponents).toEqual([0]);
    expect(numberPlaces(1204)).toEqual({
      exponents: [3, 2, 1, 0],
      fractionDigits: 0,
      scaled: 1204,
    });
  });

  it("ignores the sign", () => {
    expect(numberPlaces(-42).exponents).toEqual([1, 0]);
  });

  it("keeps the fraction digits instead of truncating them", () => {
    expect(numberPlaces(0.5)).toEqual({
      exponents: [0, -1],
      fractionDigits: 1,
      scaled: 5,
    });
    expect(numberPlaces(12.05)).toEqual({
      exponents: [1, 0, -1, -2],
      fractionDigits: 2,
      scaled: 1205,
    });
  });

  it("rounds floating point noise away", () => {
    expect(numberPlaces(0.1 + 0.2)).toEqual({
      exponents: [0, -1],
      fractionDigits: 1,
      scaled: 3,
    });
  });
});

describe("formattedPlaces", () => {
  const segmentsOf = (formatter: Intl.NumberFormat, value: number) =>
    formattedPlaces(formatter, value).segments.map(segment =>
      segment.kind === "digit" ? segment.exponent : segment.text,
    );

  it("rolls only the digits and keeps currency signs and separators still", () => {
    const usd = new Intl.NumberFormat("en-US", {
      currency: "USD",
      style: "currency",
    });

    expect(segmentsOf(usd, 1234.5)).toEqual([
      "$",
      3,
      ",",
      2,
      1,
      0,
      ".",
      -1,
      -2,
    ]);
    expect(formattedPlaces(usd, 1234.5)).toMatchObject({
      fractionDigits: 2,
      scaled: 123_450,
    });
  });

  it("keeps percent signs and compact suffixes as text", () => {
    expect(
      segmentsOf(
        new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
          style: "percent",
        }),
        0.2222,
      ),
    ).toEqual([1, 0, ".", -1, -2, "%"]);
    expect(
      segmentsOf(
        new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 1,
          notation: "compact",
        }),
        1500,
      ),
    ).toEqual([0, ".", -1, "K"]);
  });

  it("falls back to plain text for digits it cannot roll", () => {
    expect(
      formattedPlaces(new Intl.NumberFormat("ar-EG"), 42).segments,
    ).toEqual([{ key: "value", kind: "text", text: "٤٢" }]);
  });
});
