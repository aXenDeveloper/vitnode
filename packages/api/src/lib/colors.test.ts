import { describe, expect, it } from "vitest";

import type { HslColor } from "./colors";

import {
  checkColorType,
  colorContrastRatio,
  colorLuminance,
  colorToHex,
  colorToHslString,
  convertColor,
  getHSLFromString,
  getOklchFromString,
  getStringFromHSL,
  getStringFromOklch,
} from "./colors";

describe("convertColor", () => {
  describe("hslToHex", () => {
    it("should convert HSL to hex correctly", () => {
      const hsl: HslColor = { h: 0, s: 100, l: 50 }; // Red
      expect(convertColor.hslToHex(hsl)).toBe("ff0000");

      const hsl2: HslColor = { h: 120, s: 100, l: 50 }; // Green
      expect(convertColor.hslToHex(hsl2)).toBe("00ff00");

      const hsl3: HslColor = { h: 240, s: 100, l: 50 }; // Blue
      expect(convertColor.hslToHex(hsl3)).toBe("0000ff");
    });
  });

  describe("hexToHSL", () => {
    it("should convert 6-digit hex to HSL correctly", () => {
      expect(convertColor.hexToHSL("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.hexToHSL("#00ff00")).toEqual({
        h: 120,
        s: 100,
        l: 50,
      });
      expect(convertColor.hexToHSL("#0000ff")).toEqual({
        h: 240,
        s: 100,
        l: 50,
      });
    });

    it("should convert 3-digit hex to HSL correctly", () => {
      expect(convertColor.hexToHSL("#f00")).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.hexToHSL("#0f0")).toEqual({ h: 120, s: 100, l: 50 });
      expect(convertColor.hexToHSL("#00f")).toEqual({ h: 240, s: 100, l: 50 });
    });

    it("should return undefined for invalid hex values", () => {
      expect(convertColor.hexToHSL("#xyz")).toBeUndefined();
      expect(convertColor.hexToHSL("#12")).toBeUndefined();
      expect(convertColor.hexToHSL("invalid")).toBeUndefined();
    });
  });

  describe("RGBToHSL", () => {
    it("should convert RGB to HSL correctly", () => {
      expect(convertColor.RGBToHSL(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.RGBToHSL(0, 255, 0)).toEqual({
        h: 120,
        s: 100,
        l: 50,
      });
      expect(convertColor.RGBToHSL(0, 0, 255)).toEqual({
        h: 240,
        s: 100,
        l: 50,
      });
      expect(convertColor.RGBToHSL(255, 255, 255)).toEqual({
        h: 0,
        s: 0,
        l: 100,
      });
      expect(convertColor.RGBToHSL(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
    });
  });

  describe("hslToRgb", () => {
    it("should convert HSL to RGB correctly", () => {
      expect(convertColor.hslToRgb(0, 100, 50)).toEqual({
        r: "ff",
        g: "00",
        b: "00",
      });
      expect(convertColor.hslToRgb(120, 100, 50)).toEqual({
        r: "00",
        g: "ff",
        b: "00",
      });
      expect(convertColor.hslToRgb(240, 100, 50)).toEqual({
        r: "00",
        g: "00",
        b: "ff",
      });
    });
  });
});

describe("checkColorType", () => {
  it("should identify hex colors correctly", () => {
    expect(checkColorType("#fff")).toBe("hex");
    expect(checkColorType("#ffffff")).toBe("hex");
    expect(checkColorType("#FF0000")).toBe("hex");
  });

  it("should identify HSL colors correctly", () => {
    expect(checkColorType("hsl(0, 100%, 50%)")).toBe("hsl");
    expect(checkColorType("hsl(120, 60%, 70%)")).toBe("hsl");
  });

  it("should identify RGB colors correctly", () => {
    expect(checkColorType("rgb(255, 0, 0)")).toBe("rgb");
    expect(checkColorType("rgb(255 0 0)")).toBe("rgb");
  });

  it("should return null for invalid colors", () => {
    expect(checkColorType("invalid")).toBeNull();
    expect(checkColorType("rgb(300, 0, 0)")).toBeNull();
    expect(checkColorType("hsl(400, 100%, 50%)")).toBeNull();
  });
});

describe("getHSLFromString", () => {
  it("should parse valid HSL strings correctly", () => {
    expect(getHSLFromString("hsl(0, 100%, 50%)")).toEqual({
      h: 0,
      s: 100,
      l: 50,
    });
    expect(getHSLFromString("hsl(120, 60%, 70%)")).toEqual({
      h: 120,
      s: 60,
      l: 70,
    });
  });

  it("should return null for invalid HSL strings", () => {
    expect(getHSLFromString("invalid")).toBeNull();
    expect(getHSLFromString("rgb(255, 0, 0)")).toBeNull();
    expect(getHSLFromString("hsl(400, 100%, 50%")).toBeNull();
  });
});

describe("getStringFromHSL", () => {
  it("should format HSL color object to string correctly", () => {
    expect(getStringFromHSL({ h: 0, s: 100, l: 50 })).toBe("hsl(0, 100%, 50%)");
    expect(getStringFromHSL({ h: 120, s: 60, l: 70 })).toBe(
      "hsl(120, 60%, 70%)",
    );
    expect(getStringFromHSL({ h: 240, s: 50, l: 30 })).toBe(
      "hsl(240, 50%, 30%)",
    );
  });
});

describe("oklch", () => {
  const ROUND_TRIP_SAMPLES = [
    "#000000",
    "#ffffff",
    "#808080",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#2275e8",
    "#f75c59",
    "#0c0e12",
    "#3da354",
    "#863fc4",
    "#aa8e2e",
  ];

  it("survives a hex round trip without drifting", () => {
    for (const hex of ROUND_TRIP_SAMPLES) {
      const oklch = convertColor.hexToOklch(hex);
      if (!oklch) throw new Error(`${hex} could not be read as oklch`);

      expect(`#${convertColor.oklchToHex(oklch)}`, hex).toBe(hex);
    }
  });

  it("converts a known color both ways", () => {
    expect(convertColor.oklchToHex({ l: 0.58, c: 0.19, h: 258 })).toBe(
      "2275e8",
    );
    expect(convertColor.hexToOklch("#ffffff")).toEqual({ l: 1, c: 0, h: 0 });
    expect(convertColor.hexToOklch("#000000")).toEqual({ l: 0, c: 0, h: 0 });
  });

  it("clamps colors that fall outside the sRGB gamut", () => {
    expect(convertColor.oklchToHex({ l: 0.7, c: 0.4, h: 145 })).toMatch(
      /^[0-9a-f]{6}$/,
    );
  });

  it("rejects a hex string it cannot read", () => {
    expect(convertColor.hexToOklch("nope")).toBeUndefined();
    expect(convertColor.hexToOklch("#12345")).toBeUndefined();
  });

  it("parses oklch strings, with or without units", () => {
    expect(getOklchFromString("oklch(0.58 0.19 258)")).toEqual({
      l: 0.58,
      c: 0.19,
      h: 258,
    });
    expect(getOklchFromString("  OKLCH(58%  0.19  258deg) ")).toEqual({
      l: 0.58,
      c: 0.19,
      h: 258,
    });
    expect(getOklchFromString("hsl(240, 80%, 60%)")).toBeNull();
  });

  it("formats an oklch color object", () => {
    expect(getStringFromOklch({ l: 0.58, c: 0.19, h: 258 })).toBe(
      "oklch(0.58 0.19 258)",
    );
  });

  it("reports oklch as its own color type", () => {
    expect(checkColorType("oklch(0.58 0.19 258)")).toBe("oklch");
    expect(checkColorType("#2275e8")).toBe("hex");
  });
});

describe("colorToHex", () => {
  it("reads every format the color picker can hold", () => {
    expect(colorToHex("#2275e8")).toBe("#2275e8");
    expect(colorToHex("#abc")).toBe("#aabbcc");
    expect(colorToHex("oklch(0.58 0.19 258)")).toBe("#2275e8");
    expect(colorToHex("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(colorToHex("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(colorToHex("rgb(0 128 255)")).toBe("#0080ff");
  });

  it("returns nothing for a color it cannot read", () => {
    expect(colorToHex("")).toBeUndefined();
    expect(colorToHex("rebeccapurple")).toBeUndefined();
  });
});

describe("colorToHslString", () => {
  it("passes an hsl string through untouched", () => {
    expect(colorToHslString("hsl(215, 81%, 52%)")).toBe("hsl(215, 81%, 52%)");
    expect(colorToHslString(" HSL(215,  81%, 52%) ")).toBe(
      "hsl(215, 81%, 52%)",
    );
  });

  it("converts the other formats it can read", () => {
    expect(colorToHslString("#ff0000")).toBe("hsl(0, 100%, 50%)");
    expect(colorToHslString("oklch(0.58 0.19 258)")).toBe("hsl(215, 81%, 52%)");
    expect(colorToHslString("rgb(255, 0, 0)")).toBe("hsl(0, 100%, 50%)");
  });

  it("returns nothing for a color it cannot read", () => {
    expect(colorToHslString("")).toBeUndefined();
    expect(colorToHslString("rebeccapurple")).toBeUndefined();
  });
});

describe("colorLuminance", () => {
  it("measures the extremes", () => {
    expect(colorLuminance("oklch(1 0 0)")).toBeCloseTo(1, 3);
    expect(colorLuminance("#000000")).toBe(0);
    expect(colorLuminance("nope")).toBeUndefined();
  });

  it("computes contrast between two readable colors", () => {
    expect(colorContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(colorContrastRatio("oklch(1 0 0)", "#ffffff")).toBeCloseTo(1, 3);
    expect(colorContrastRatio("nope", "#ffffff")).toBeUndefined();
  });
});
