export interface HslColor {
  h: number;
  l: number;
  s: number;
}

export interface OklchColor {
  c: number;
  h: number;
  l: number;
}

export const convertColor = {
  hslToHex: ({ h, l, s }: HslColor): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };

    return `${f(0)}${f(8)}${f(4)}`;
  },

  hexToHSL: (hex: string): HslColor | undefined => {
    if (!hexRegex.test(hex)) return undefined;

    let b = 0;
    let g = 0;
    let r = 0;

    // 3 digits
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    }
    // 6 digits
    else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    } else {
      return undefined;
    }

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return undefined;
    }

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case b:
          h = (r - g) / d + 4;
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  },

  RGBToHSL(r: number, g: number, b: number): HslColor {
    // Make r, g, and b fractions of 1
    r /= 255;
    g /= 255;
    b /= 255;

    // Find greatest and smallest channel values
    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;

    let h = 0;
    let l = 0;
    let s = 0;

    // Calculate hue
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    // Make negative hues positive behind 360°
    if (h < 0) h += 360;

    // Calculate lightness
    l = (cmax + cmin) / 2;

    // Calculate saturation
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    // Multiply l and s by 100
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return {
      h,
      s,
      l,
    };
  },

  hexToOklch(hex: string): OklchColor | undefined {
    const channels = getRgbChannelsFromHex(hex);
    if (!channels) return undefined;

    const [long, medium, short] = mulMatrix(
      LINEAR_RGB_TO_LMS,
      channels.map(srgbToLinear),
    ).map(value => Math.cbrt(value));
    const [l, a, b] = mulMatrix(LMS_TO_OKLAB, [long, medium, short]);
    const c = Math.hypot(a, b);

    return {
      l: roundTo(l, 5),
      c: roundTo(c, 5),
      h:
        c < 1e-5
          ? 0
          : roundTo(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360, 3),
    };
  },

  oklchToHex({ c, h, l }: OklchColor): string {
    const hueInRadians = (h * Math.PI) / 180;
    const a = c * Math.cos(hueInRadians);
    const b = c * Math.sin(hueInRadians);
    const lms = mulMatrix(OKLAB_TO_LMS, [l, a, b]).map(value => value ** 3);

    return mulMatrix(LMS_TO_LINEAR_RGB, lms)
      .map(channel =>
        Math.round(Math.min(1, Math.max(0, linearToSrgb(channel))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  },

  hslToRgb(h: number, s: number, l: number) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0"); // convert to Hex and prefix "0" if needed
    };

    return {
      r: f(0),
      g: f(8),
      b: f(4),
    };
  },
};

const LINEAR_RGB_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const OKLAB_TO_LMS = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const LMS_TO_LINEAR_RGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const mulMatrix = (matrix: number[][], vector: number[]): number[] =>
  matrix.map(row =>
    row.reduce((sum, cell, index) => sum + cell * vector[index], 0),
  );

const srgbToLinear = (channel: number): number => {
  const scaled = channel / 255;

  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (channel: number): number =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

const roundTo = (value: number, digits: number): number =>
  Number(value.toFixed(digits));

const getRgbChannelsFromHex = (
  hex: string,
): [red: number, green: number, blue: number] | undefined => {
  if (!hexRegex.test(hex)) return undefined;

  const digits = hex.replace("#", "");
  const expanded =
    digits.length === 3
      ? digits
          .split("")
          .map(digit => digit + digit)
          .join("")
      : digits;

  return [0, 2, 4].map(offset =>
    parseInt(expanded.slice(offset, offset + 2), 16),
  ) as [number, number, number];
};

export const hexRegex = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export const hslRegex =
  /^hsl\(\s*(?:36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(?:100|[1-9]?[0-9])%\s*,\s*(?:100|[1-9]?[0-9])%\s*\)$/;
export const rgbWithCommaRegex =
  /^rgb\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*\)$/;

export const rgbWithoutCommaRegex =
  /^rgb\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s+([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s+([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*\)$/;

export const oklchRegex =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)(?:deg)?\s*\)$/i;

export const checkColorType = (
  strColor: string,
): "hex" | "hsl" | "oklch" | "rgb" | null => {
  if (oklchRegex.test(strColor.trim())) {
    return "oklch";
  }

  if (hexRegex.test(strColor)) {
    return "hex";
  }

  if (hslRegex.test(strColor)) {
    return "hsl";
  }

  if (rgbWithoutCommaRegex.test(strColor) || rgbWithCommaRegex.test(strColor)) {
    return "rgb";
  }

  return null;
};

export const getHSLFromString = (string: string): HslColor | null => {
  if (!hslRegex.test(string)) return null;

  const [h, s, l] = string
    .replaceAll("hsl(", "")
    .replaceAll(")", "")
    .replaceAll("%", "")
    .split(",")
    .map(Number);

  return { h, s, l };
};

export const getStringFromHSL = ({ h, l, s }: HslColor): string => {
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const normalizeColorString = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export const getOklchFromString = (value: string): null | OklchColor => {
  const parsed = oklchRegex.exec(normalizeColorString(value));
  if (!parsed) return null;

  const [, lightness, lightnessUnit, chroma, chromaUnit, hue] = parsed;

  return {
    l: Number(lightness) / (lightnessUnit === "%" ? 100 : 1),
    c: Number(chroma) * (chromaUnit === "%" ? 0.004 : 1),
    h: Number(hue),
  };
};

export const getStringFromOklch = ({ c, h, l }: OklchColor): string =>
  `oklch(${l} ${c} ${h})`;

export const colorToHex = (value: string): string | undefined => {
  const color = normalizeColorString(value);
  const channels = getRgbChannelsFromHex(color);
  if (channels) {
    return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  const oklch = getOklchFromString(color);
  if (oklch) return `#${convertColor.oklchToHex(oklch)}`;

  const hsl = getHSLFromString(color);
  if (hsl) return `#${convertColor.hslToHex(hsl)}`;

  const rgb = rgbWithCommaRegex.exec(color) ?? rgbWithoutCommaRegex.exec(color);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map(channel => Number(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  return undefined;
};

export const colorToHslString = (value: string): string | undefined => {
  const color = normalizeColorString(value);
  const hsl = getHSLFromString(color);
  if (hsl) return getStringFromHSL(hsl);

  const hex = colorToHex(color);
  const converted = hex ? convertColor.hexToHSL(hex) : undefined;

  return converted ? getStringFromHSL(converted) : undefined;
};

export const colorLuminance = (value: string): number | undefined => {
  const hex = colorToHex(value);
  const channels = hex ? getRgbChannelsFromHex(hex) : undefined;
  if (!channels) return undefined;

  const [red, green, blue] = channels.map(srgbToLinear);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const colorContrastRatio = (
  value: string,
  otherValue: string,
): number | undefined => {
  const luminance = colorLuminance(value);
  const otherLuminance = colorLuminance(otherValue);
  if (luminance === undefined || otherLuminance === undefined) return undefined;

  return (
    (Math.max(luminance, otherLuminance) + 0.05) /
    (Math.min(luminance, otherLuminance) + 0.05)
  );
};
