import { createHash } from "node:crypto";

import type {
  OgImageBranding,
  OgImageColors,
  OgImageFont,
  OgImagesConfig,
  OgImageTemplate,
} from "./types";

import { defaultOgImageTemplate } from "./default-template";
import { OG_IMAGE_DEFAULT_TEMPLATE_ID } from "./types";

const TEMPLATE_ID = /^[a-z0-9_-]{1,64}$/;

const DEFAULT_COLORS: OgImageColors = {
  accent: "#3261bf",
  background: "#ffffff",
  foreground: "#0f172a",
  muted: "#475569",
};

/** `ogImages` with its defaults applied, as routes read it from `c.get("core").ogImages`. */
export interface ResolvedOgImagesConfig {
  branding: Omit<OgImageBranding, "colors"> & { colors: OgImageColors };
  /**
   * A short hash of everything outside the templates that changes how an image
   * looks: `version`, the branding and the font names. Part of every cache key.
   */
  configVersion: string;
  defaultTemplate: string;
  fonts: OgImageFont[];
  templates: ReadonlyMap<string, OgImageTemplate>;
}

/** A template as the AdminCP lists it: no functions, nothing secret. */
export interface OgImageTemplateSummary {
  id: string;
  isDefault: boolean;
  version: string;
}

export class OgImageConfigError extends Error {
  constructor(message: string) {
    super(`[VitNode ogImages] ${message}`);
    this.name = "OgImageConfigError";
  }
}

/** Whether `id` is a well-formed template id; says nothing about whether it is registered. */
export const isOgImageTemplateId = (id: unknown): id is string =>
  typeof id === "string" && TEMPLATE_ID.test(id);

const shortHash = (value: string): string =>
  createHash("sha256").update(value).digest("base64url").slice(0, 16);

/**
 * Validates `ogImages` and fills its defaults. Returns `null` when the block is
 * not set, which leaves generated images off.
 *
 * @throws {@link OgImageConfigError} for an invalid template id, a template
 * without `render` or `version`, or a `defaultTemplate` that is not registered.
 */
export const resolveOgImagesConfig = (
  config: OgImagesConfig | undefined,
): null | ResolvedOgImagesConfig => {
  if (!config) return null;

  const templates = new Map<string, OgImageTemplate>([
    [OG_IMAGE_DEFAULT_TEMPLATE_ID, defaultOgImageTemplate],
  ]);

  for (const [id, template] of Object.entries(config.templates ?? {})) {
    if (!isOgImageTemplateId(id)) {
      throw new OgImageConfigError(
        `Template id "${id}" must be 1-64 characters of a-z, 0-9, "-" and "_".`,
      );
    }
    if (
      typeof template?.render !== "function" ||
      typeof template.version !== "string" ||
      template.version === ""
    ) {
      throw new OgImageConfigError(
        `Template "${id}" needs a render function and a non-empty version.`,
      );
    }
    templates.set(id, template);
  }

  const defaultTemplate =
    config.defaultTemplate ?? OG_IMAGE_DEFAULT_TEMPLATE_ID;
  if (!templates.has(defaultTemplate)) {
    throw new OgImageConfigError(
      `defaultTemplate "${defaultTemplate}" is not a registered template. Registered: ${[...templates.keys()].join(", ")}.`,
    );
  }

  const colors = { ...DEFAULT_COLORS, ...config.branding?.colors };
  const fonts = config.fonts ?? [];
  const logo = config.branding?.logo;

  return {
    branding: { ...config.branding, colors },
    configVersion: shortHash(
      JSON.stringify([
        config.version ?? "",
        config.branding?.siteName ?? "",
        colors,
        typeof logo === "string" ? logo : logo ? "fn" : "",
        fonts.map(font => [font.name, font.weight ?? 400, font.style ?? ""]),
      ]),
    ),
    defaultTemplate,
    fonts,
    templates,
  };
};

/**
 * Picks the template for one image. A missing id means the configured default;
 * an id that is not registered falls back to the default too, unless `strict`
 * (the AdminCP preview), where it is `null`.
 */
export const selectOgImageTemplate = (
  config: ResolvedOgImagesConfig,
  id: null | string | undefined,
  { strict = false }: { strict?: boolean } = {},
): null | { id: string; template: OgImageTemplate } => {
  if (id !== null && id !== undefined) {
    const template = config.templates.get(id);
    if (template) return { id, template };
    if (strict) return null;
  }

  const template = config.templates.get(config.defaultTemplate);

  return template ? { id: config.defaultTemplate, template } : null;
};

/** The registered templates, the default first. Serializable. */
export const listOgImageTemplates = (
  config: ResolvedOgImagesConfig,
): OgImageTemplateSummary[] =>
  [...config.templates]
    .map(([id, template]) => ({
      id,
      isDefault: id === config.defaultTemplate,
      version: template.version,
    }))
    .toSorted((a, b) =>
      a.isDefault === b.isDefault
        ? a.id.localeCompare(b.id)
        : a.isDefault
          ? -1
          : 1,
    );
