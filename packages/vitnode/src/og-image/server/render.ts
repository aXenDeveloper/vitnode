import type { ReactNode } from "react";
import type { SatoriOptions } from "satori";

import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/og-image";

import type { LoadedOgImageFont } from "./fonts";

/**
 * Lays one JSX card out with Satori and rasterizes it to a 1200 × 630 PNG
 * with resvg, through `@napi-rs/image` - the same native module that prepares
 * covers and logos, statically linked so it survives bundled server output.
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

  const { Transformer } = await import("@napi-rs/image");

  return await Transformer.fromSvg(svg).png();
};
