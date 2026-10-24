import type { ReactNode } from "react";
import type { SatoriOptions } from "satori";

import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/og-image";

import type { LoadedOgImageFont } from "./fonts";

type Rasterize = (svg: string) => Promise<Uint8Array>;

let rasterizer: Promise<Rasterize> | undefined;

/**
 * `@resvg/resvg-js`, a statically linked native module, or `sharp` (librsvg)
 * when no resvg binary exists for this platform. Resolved once per process.
 *
 * @throws When neither can be loaded.
 */
const loadRasterizer = async (): Promise<Rasterize> => {
  try {
    const { Resvg } = await import("@resvg/resvg-js");

    return async svg =>
      await Promise.resolve(
        new Resvg(svg, {
          fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
        })
          .render()
          .asPng(),
      );
  } catch (resvgError) {
    try {
      const { default: sharp } = await import("sharp");

      return async svg =>
        new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
    } catch {
      throw new Error(
        "Open Graph images need @resvg/resvg-js or sharp, and neither could be loaded.",
        { cause: resvgError },
      );
    }
  }
};

/**
 * Lays one JSX card out with Satori and rasterizes it to a 1200 × 630 PNG.
 *
 * Nothing is fetched while rendering unless `loadAdditionalAsset` fetches it:
 * images arrive as `data:` URIs, and without that hook a character no font
 * covers (an emoji, a Chinese title with only the bundled Inter) is drawn as
 * a "no glyph" box rather than downloaded from a CDN.
 *
 * Server-only. Satori and the rasterizer load on the first call.
 */
export const renderOgImagePng = async (
  element: ReactNode,
  fonts: LoadedOgImageFont[],
  { loadAdditionalAsset }: Pick<SatoriOptions, "loadAdditionalAsset"> = {},
): Promise<Uint8Array> => {
  const { default: satori } = await import("satori");
  const svg = await satori(element, {
    fonts: fonts.map(font => ({
      data: font.data,
      name: font.name,
      style: font.style,
      weight: font.weight,
    })),
    height: OG_IMAGE_HEIGHT,
    loadAdditionalAsset,
    width: OG_IMAGE_WIDTH,
  });

  rasterizer ??= loadRasterizer().catch((error: unknown) => {
    rasterizer = undefined;
    throw error;
  });

  return await (
    await rasterizer
  )(svg);
};
