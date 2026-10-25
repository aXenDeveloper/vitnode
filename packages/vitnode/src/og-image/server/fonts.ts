import type { OgImageBinarySource, OgImageFont } from "./types";

/** The `fontFamily` stack the bundled fonts answer to. */
export const OG_IMAGE_DEFAULT_FONT_FAMILY = "Inter, 'Inter Latin Ext'";

/** What Satori takes: bytes, already loaded. */
export interface LoadedOgImageFont {
  data: ArrayBuffer;
  name: string;
  style?: "italic" | "normal";
  weight?: OgImageFont["weight"];
}

/**
 * Inter regular and bold, split into the Latin and Latin Extended subsets
 * (`@fontsource/inter`, OFL-1.1). Latin Extended covers Polish, Czech,
 * Turkish and the rest of the European Latin alphabets.
 *
 * The bytes ship inside this package (`inter-fonts.gen.ts`), imported on the
 * first render: a server bundler copies JavaScript it can see, not font files
 * a module would read from `node_modules` by path.
 */
const bundledFonts = (): OgImageFont[] => {
  const fonts = import("./inter-fonts.gen");
  const face = (
    name: string,
    weight: 400 | 700,
    pick: (data: Awaited<typeof fonts>) => string,
  ): OgImageFont => ({
    data: async () => Buffer.from(pick(await fonts), "base64"),
    name,
    style: "normal",
    weight,
  });

  return [
    face("Inter", 400, data => data.interLatin400),
    face("Inter", 700, data => data.interLatin700),
    face("Inter Latin Ext", 400, data => data.interLatinExt400),
    face("Inter Latin Ext", 700, data => data.interLatinExt700),
  ];
};

/** Copies into a standalone `ArrayBuffer`, never a view on a pooled one. */
export const toArrayBuffer = (bytes: ArrayBuffer | Uint8Array): ArrayBuffer =>
  bytes instanceof ArrayBuffer
    ? bytes
    : (bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer);

/** Bytes from a {@link OgImageBinarySource}. */
export const readBinarySource = async (
  source: OgImageBinarySource,
): Promise<ArrayBuffer> =>
  toArrayBuffer(typeof source === "function" ? await source() : source);

const loaded = new WeakMap<object, Promise<LoadedOgImageFont[]>>();
let bundled: Promise<LoadedOgImageFont[]> | undefined;

const loadAll = async (fonts: OgImageFont[]): Promise<LoadedOgImageFont[]> =>
  await Promise.all(
    fonts.map(async font => ({
      data: await readBinarySource(font.data),
      name: font.name,
      style: font.style ?? "normal",
      weight: font.weight ?? 400,
    })),
  );

/**
 * Loads a font list once per process and hands every later render the same
 * bytes. `undefined` means the bundled Inter. A failed load is not remembered,
 * so the next request tries again.
 */
export const loadOgImageFonts = async (
  fonts: OgImageFont[] | undefined,
): Promise<LoadedOgImageFont[]> => {
  let pending: Promise<LoadedOgImageFont[]>;
  if (fonts) {
    pending = loaded.get(fonts) ?? loadAll(fonts);
    loaded.set(fonts, pending);
  } else {
    pending = bundled ??= loadAll(bundledFonts());
  }

  try {
    return await pending;
  } catch (error) {
    if (fonts) loaded.delete(fonts);
    else bundled = undefined;

    throw error;
  }
};
