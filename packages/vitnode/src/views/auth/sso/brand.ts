const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const LIGHT_FOREGROUND = "#ffffff";
const DARK_FOREGROUND = "#0a0a0a";
const MIN_TEXT_CONTRAST = 4.5;

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

const relativeLuminance = (hex: string) => {
  const digits = expandHex(hex);
  const [red, green, blue] = [0, 2, 4].map(start =>
    linearChannel(Number.parseInt(digits.slice(start, start + 2), 16)),
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (lighter: number, darker: number) =>
  (lighter + 0.05) / (darker + 0.05);

export const ssoBrandForeground = (brandColor: string): string => {
  const luminance = relativeLuminance(brandColor);
  const onLight = contrastRatio(1, luminance);
  const onDark = contrastRatio(luminance, relativeLuminance(DARK_FOREGROUND));

  return onLight >= MIN_TEXT_CONTRAST || onLight >= onDark
    ? LIGHT_FOREGROUND
    : DARK_FOREGROUND;
};
