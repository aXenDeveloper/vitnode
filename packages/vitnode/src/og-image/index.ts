/**
 * Generated Open Graph images: configuration types, the built-in template and
 * the server-side generator. Server-only - import it from
 * `vitnode.api.config.ts`, template `.tsx` files and Hono routes, never from a
 * page or component.
 */
export type { OgImageCoverSource } from "./assets.server";
export {
  OG_IMAGE_ASSET_MAX_BYTES,
  OG_IMAGE_ASSET_TIMEOUT_MS,
} from "./assets.server";
export type { OgImageTemplateSummary, ResolvedOgImagesConfig } from "./config";
export {
  isOgImageTemplateId,
  listOgImageTemplates,
  OgImageConfigError,
  resolveOgImagesConfig,
  selectOgImageTemplate,
} from "./config";
export { defaultOgImageTemplate } from "./default-template";
export { clampOgText, normalizeOgImageText } from "./input";
export type { OgImageRenderInput, PreparedOgImage } from "./render.server";
export {
  OG_IMAGE_NO_STORE,
  OG_IMAGE_PUBLIC_CACHE_CONTROL,
  ogImageResponse,
  OgImagesNotEnabledError,
  prepareOgImage,
} from "./render.server";
export type {
  OgImageAsset,
  OgImageBranding,
  OgImageColors,
  OgImageFont,
  OgImagesConfig,
  OgImageTemplate,
  OgImageTemplateInput,
} from "./types";
export {
  defineOgImageTemplate,
  OG_IMAGE_DEFAULT_TEMPLATE_ID,
  OG_IMAGE_DESCRIPTION_MAX_LENGTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TITLE_MAX_LENGTH,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
} from "./types";
