import type { OgImageTemplate, OgImageTemplateInput } from "./types";

import { ogTitleFontSize, truncateOgText } from "./text";

/** Bumped whenever the built-in layout changes, so cached cards re-render. */
export const DEFAULT_OG_IMAGE_TEMPLATE_VERSION = "1";

const COVER_WIDTH = 480;
const PADDING = 64;

const hostOf = (url: null | string): null | string => {
  if (url === null) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const Brand = ({ logo, siteName, theme }: OgImageTemplateInput) => (
  <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
    {logo ? (
      <img
        alt=""
        height={56}
        src={logo.src}
        style={{ objectFit: "contain" }}
        width={Math.min(Math.round((logo.width / logo.height) * 56), 220)}
      />
    ) : null}
    <div
      style={{
        color: theme.accentColor,
        display: "flex",
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      {truncateOgText(siteName, 40)}
    </div>
  </div>
);

/**
 * The built-in card: site name and logo on top, the title large, the
 * description under it and the page's host at the bottom, with the cover
 * image filling the right side when there is one. Long titles shrink and are
 * cut at a word boundary; missing parts simply leave their space out.
 */
export const defaultOgImageTemplate = (input: OgImageTemplateInput) => {
  const { cover, description, height, locale, theme, url, width } = input;
  const titleLimit = cover ? 90 : 110;
  const title = truncateOgText(input.title, titleLimit);
  const host = hostOf(url);

  return (
    <div
      lang={locale}
      style={{
        backgroundColor: theme.backgroundColor,
        color: theme.foregroundColor,
        display: "flex",
        fontFamily: theme.fontFamily,
        height,
        width,
      }}
    >
      <div
        style={{
          backgroundColor: theme.accentColor,
          display: "flex",
          height: "100%",
          width: 12,
        }}
      />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: PADDING,
        }}
      >
        <Brand {...input} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "block",
              fontSize: ogTitleFontSize(title) - (cover ? 8 : 0),
              fontWeight: 700,
              letterSpacing: -1,
              lineClamp: 4,
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                color: theme.mutedColor,
                display: "block",
                fontSize: 30,
                lineClamp: 2,
                lineHeight: 1.4,
              }}
            >
              {truncateOgText(description, cover ? 110 : 160)}
            </div>
          ) : null}
        </div>
        <div
          style={{
            color: theme.mutedColor,
            display: "flex",
            fontSize: 24,
          }}
        >
          {host ?? ""}
        </div>
      </div>
      {cover ? (
        <img
          alt=""
          height={height}
          src={cover.src}
          style={{ objectFit: "cover" }}
          width={COVER_WIDTH}
        />
      ) : null}
    </div>
  );
};

/** {@link defaultOgImageTemplate} as an `ogImages.templates` entry. */
export const defaultOgImageTemplateEntry: OgImageTemplate = {
  label: "VitNode",
  render: defaultOgImageTemplate,
  version: DEFAULT_OG_IMAGE_TEMPLATE_VERSION,
};
