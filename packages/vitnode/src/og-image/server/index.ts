/**
 * Server-only Open Graph image generation, built on `@vercel/og`: the config
 * types for `buildApiConfig({ ogImages })`, the built-in template and the
 * generator plugins call from their own Hono routes.
 */
export type { OgImageAssetSource } from "./assets";
export { OG_IMAGE_ASSET_MAX_BYTES } from "./assets";
export {
  OG_IMAGE_LOCAL_CACHE_MAX_BYTES,
  OG_IMAGE_SHARED_CACHE_TTL_SECONDS,
} from "./cache";
export type { ResolvedOgImagesConfig } from "./config";
export {
  OG_IMAGE_DEFAULT_TEMPLATE_ID,
  OgImagesConfigError,
  OgImageTemplateNotFoundError,
  ogImageTemplateSummaries,
  resolveOgImagesConfig,
  selectOgImageTemplate,
} from "./config";
export {
  DEFAULT_OG_IMAGE_TEMPLATE_VERSION,
  defaultOgImageTemplate,
  defaultOgImageTemplateEntry,
} from "./default-template";
export { OG_IMAGE_DEFAULT_FONT_FAMILY } from "./fonts";
export type { OgImageRequest, OgImageResult } from "./generate";
export {
  generateOgImage,
  OgImageInputError,
  OgImagesDisabledError,
} from "./generate";
export {
  OG_IMAGE_PRIVATE_CACHE_CONTROL,
  OG_IMAGE_PUBLIC_CACHE_CONTROL,
  ogImageResponse,
} from "./response";
export { ogTitleFontSize, truncateOgText } from "./text";
export type {
  OgImageBinarySource,
  OgImageBranding,
  OgImageFont,
  OgImagesConfig,
  OgImageTemplate,
  OgImageTemplateAsset,
  OgImageTemplateInput,
  OgImageTemplateRender,
  OgImageTheme,
} from "./types";
