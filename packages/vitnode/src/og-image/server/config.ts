import { createHash } from "node:crypto";

import type { OgImageTemplateSummary } from "@/og-image";

import { isOgImageTemplateId } from "@/og-image";

import type { DescribedOgImageAsset } from "./assets";
import type {
  OgImageFont,
  OgImagesConfig,
  OgImageTemplate,
  OgImageTheme,
} from "./types";

import { describeOgLogo } from "./assets";
import { defaultOgImageTemplateEntry } from "./default-template";
import { OG_IMAGE_DEFAULT_FONT_FAMILY } from "./fonts";

/** The template id used when `ogImages.defaultTemplate` is unset. */
export const OG_IMAGE_DEFAULT_TEMPLATE_ID = "default";

const DEFAULT_THEME: OgImageTheme = {
  accentColor: "#3b82f6",
  backgroundColor: "#0b1220",
  fontFamily: OG_IMAGE_DEFAULT_FONT_FAMILY,
  foregroundColor: "#f8fafc",
  mutedColor: "#94a3b8",
};

/** `ogImages` with every default applied, built once at startup. */
export interface ResolvedOgImagesConfig {
  /**
   * A hash of everything install-wide that changes a card: theme, site name,
   * logo, fonts and `version`. Part of every cache key.
   */
  configIdentity: string;
  defaultTemplate: string;
  fonts: OgImageFont[] | undefined;
  logo: DescribedOgImageAsset | null;
  siteName: string;
  templates: ReadonlyMap<string, OgImageTemplate>;
  theme: OgImageTheme;
}

/** Thrown at startup for an `ogImages` block that cannot work. */
export class OgImagesConfigError extends Error {
  constructor(message: string) {
    super(`ogImages: ${message}`);
    this.name = "OgImagesConfigError";
  }
}

/** Thrown when a caller names a template that is not registered. */
export class OgImageTemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Open Graph image template "${templateId}" is not registered.`);
    this.name = "OgImageTemplateNotFoundError";
    this.templateId = templateId;
  }

  readonly templateId: string;
}

const assertTemplate = (id: string, template: OgImageTemplate): void => {
  if (!isOgImageTemplateId(id)) {
    throw new OgImagesConfigError(
      `template id "${id}" must be 1-64 characters of a-z, 0-9, "-" and "_", starting with a letter or digit.`,
    );
  }
  if (typeof template.render !== "function") {
    throw new OgImagesConfigError(`templates.${id}.render must be a function.`);
  }
  if (typeof template.version !== "string" || template.version.trim() === "") {
    throw new OgImagesConfigError(
      `templates.${id}.version must be a non-empty string. It is part of every cached image's key, so bump it when the template changes.`,
    );
  }
};

/**
 * Validates `ogImages` and fills in its defaults. `null` when the block is
 * absent, which keeps every Open Graph image route switched off.
 *
 * @throws {OgImagesConfigError} For an invalid template id, a template without
 * `render` or `version`, or a `defaultTemplate` that is not registered.
 */
export const resolveOgImagesConfig = (
  config: OgImagesConfig | undefined,
  metadata: { shortTitle?: string; title: string },
): null | ResolvedOgImagesConfig => {
  if (!config) return null;

  const entries = Object.entries(
    config.templates ?? {
      [OG_IMAGE_DEFAULT_TEMPLATE_ID]: defaultOgImageTemplateEntry,
    },
  );
  if (entries.length === 0) {
    throw new OgImagesConfigError("templates must register at least one.");
  }
  for (const [id, template] of entries) assertTemplate(id, template);

  const templates = new Map(entries);
  const defaultTemplate =
    config.defaultTemplate ?? OG_IMAGE_DEFAULT_TEMPLATE_ID;
  if (!templates.has(defaultTemplate)) {
    throw new OgImagesConfigError(
      `defaultTemplate is "${defaultTemplate}", which is not in templates (${[...templates.keys()].join(", ")}).`,
    );
  }

  const theme = { ...DEFAULT_THEME, ...config.theme };
  const brandName = config.branding?.siteName?.trim() ?? "";
  const siteName =
    brandName === "" ? (metadata.shortTitle ?? metadata.title) : brandName;
  const logo = describeOgLogo(config.branding?.logo);

  return {
    configIdentity: createHash("sha256")
      .update(
        JSON.stringify({
          fonts: config.fonts?.map(font => [
            font.name,
            font.weight ?? 400,
            font.style ?? "normal",
          ]),
          logo: logo?.identity ?? null,
          siteName,
          theme,
          version: config.version ?? null,
        }),
      )
      .digest("base64url")
      .slice(0, 16),
    defaultTemplate,
    fonts: config.fonts,
    logo,
    siteName,
    templates,
    theme,
  };
};

/**
 * The template to render: `requested` when given, else the configured
 * default.
 *
 * @throws {OgImageTemplateNotFoundError} When `requested` is not registered.
 * A stale id is an error to fix, not something to paper over with another
 * template.
 */
export const selectOgImageTemplate = (
  config: ResolvedOgImagesConfig,
  requested?: null | string,
): { id: string; template: OgImageTemplate } => {
  const id = requested ?? config.defaultTemplate;
  const template = config.templates.get(id);
  if (!template) throw new OgImageTemplateNotFoundError(id);

  return { id, template };
};

/** The registered templates, default first - all the AdminCP is ever sent. */
export const ogImageTemplateSummaries = (
  config: ResolvedOgImagesConfig,
): OgImageTemplateSummary[] =>
  [...config.templates]
    .map(([id, template]) => ({
      id,
      isDefault: id === config.defaultTemplate,
      label: template.label ?? null,
      version: template.version,
    }))
    .sort((a, b) =>
      a.isDefault === b.isDefault
        ? a.id.localeCompare(b.id)
        : a.isDefault
          ? -1
          : 1,
    );
