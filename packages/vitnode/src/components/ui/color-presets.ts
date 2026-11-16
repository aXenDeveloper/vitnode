import { colorLuminance, normalizeColorString } from "@vitnode/api/lib/colors";

export const COLOR_PRESET_ROWS = [
  [
    { id: "default", value: "" },
    { id: "light_red", value: "hsl(1, 91%, 66%)" },
    { id: "light_orange", value: "hsl(27, 66%, 51%)" },
    { id: "light_yellow", value: "hsl(46, 57%, 42%)" },
    { id: "light_green", value: "hsl(134, 46%, 44%)" },
    { id: "light_teal", value: "hsl(185, 57%, 42%)" },
    { id: "light_blue", value: "hsl(216, 100%, 63%)" },
    { id: "light_purple", value: "hsl(270, 91%, 70%)" },
  ],
  [
    { id: "gray", value: "hsl(218, 4%, 48%)" },
    { id: "red", value: "hsl(0, 67%, 55%)" },
    { id: "orange", value: "hsl(30, 90%, 38%)" },
    { id: "yellow", value: "hsl(48, 92%, 30%)" },
    { id: "green", value: "hsl(137, 66%, 33%)" },
    { id: "teal", value: "hsl(185, 97%, 29%)" },
    { id: "blue", value: "hsl(215, 81%, 52%)" },
    { id: "purple", value: "hsl(271, 67%, 60%)" },
  ],
  [
    { id: "dark_gray", value: "hsl(218, 5%, 40%)" },
    { id: "dark_red", value: "hsl(357, 68%, 45%)" },
    { id: "dark_orange", value: "hsl(30, 99%, 31%)" },
    { id: "dark_yellow", value: "hsl(48, 98%, 24%)" },
    { id: "dark_green", value: "hsl(142, 97%, 23%)" },
    { id: "dark_teal", value: "hsl(185, 100%, 24%)" },
    { id: "dark_blue", value: "hsl(212, 100%, 40%)" },
    { id: "dark_purple", value: "hsl(272, 53%, 51%)" },
  ],
] as const satisfies readonly (readonly { id: string; value: string }[])[];

export type ColorPresetId = (typeof COLOR_PRESET_ROWS)[number][number]["id"];

export interface ColorPreset {
  id: ColorPresetId;
  value: string;
}

export const COLOR_PRESETS: readonly ColorPreset[] = COLOR_PRESET_ROWS.flat();

export const DEFAULT_COLOR_PRESET = COLOR_PRESETS[0];

export const findColorPreset = (value: string): ColorPreset | undefined => {
  const normalized = normalizeColorString(value);

  return COLOR_PRESETS.find(preset => preset.value === normalized);
};

export const getColorPresetId = (value: string): ColorPresetId | null =>
  findColorPreset(value)?.id ?? null;

export const getColorPresetValue = (id: string): string =>
  COLOR_PRESETS.find(preset => preset.id === id)?.value ??
  DEFAULT_COLOR_PRESET.value;

const DARK_CHECK_MARK_LUMINANCE = 0.24;

export const prefersDarkCheckMark = (value: string): boolean =>
  (colorLuminance(value) ?? 0) > DARK_CHECK_MARK_LUMINANCE;
