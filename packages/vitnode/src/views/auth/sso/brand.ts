const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const LIGHT_FOREGROUND = "#ffffff";
const DARK_FOREGROUND = "#0a0a0a";
const MIN_TEXT_CONTRAST = 4.5;
const HOVER_SHIFT = 0.12;

export const ssoBrandColor = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const color = value.trim().toLowerCase();

  return HEX_COLOR.test(color) ? color : undefined;
};

const expandHex = (hex: string) =>
  hex.length === 4
    ? hex
        .slice(1)
        .split("")
        .map(digit => digit + digit)
        .join("")
    : hex.slice(1);

const linearChannel = (value: number) => {
  const channel = value / 255;

  return channel <= 0.040_45
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
};

const channelsOf = (hex: string) => {
  const digits = expandHex(hex);

  return [0, 2, 4].map(start =>
    Number.parseInt(digits.slice(start, start + 2), 16),
  );
};

const toHex = (channels: number[]) =>
  `#${channels
    .map(channel => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const shiftToward = (hex: string, target: number) =>
  toHex(
    channelsOf(hex).map(channel => channel + (target - channel) * HOVER_SHIFT),
  );

const relativeLuminance = (hex: string) => {
  const [red, green, blue] = channelsOf(hex).map(linearChannel);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (lighter: number, darker: number) =>
  (lighter + 0.05) / (darker + 0.05);

const brandForeground = (brandColor: string) => {
  const luminance = relativeLuminance(brandColor);
  const whiteTextContrast = contrastRatio(1, luminance);
  const darkTextContrast = contrastRatio(
    luminance,
    relativeLuminance(DARK_FOREGROUND),
  );

  return whiteTextContrast >= MIN_TEXT_CONTRAST ||
    whiteTextContrast >= darkTextContrast
    ? LIGHT_FOREGROUND
    : DARK_FOREGROUND;
};

export const ssoBrandColors = (brandColor: string) => {
  const foreground = brandForeground(brandColor);

  return {
    foreground,
    hover: shiftToward(brandColor, foreground === LIGHT_FOREGROUND ? 0 : 255),
  };
};
