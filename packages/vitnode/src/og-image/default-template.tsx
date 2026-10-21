import type { OgImageTemplateInput } from "./types";

import { defineOgImageTemplate } from "./types";

const PADDING = 64;
const COVER_WIDTH = 480;

const titleSize = (title: string, withCover: boolean): number => {
  const length = title.length;
  const base = length <= 32 ? 72 : length <= 64 ? 60 : 50;

  return withCover ? base - 8 : base;
};

const hostOf = (url: null | string): null | string => {
  if (url === null) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const Footer = ({ colors, logo, siteName, url }: OgImageTemplateInput) => {
  const host = hostOf(url);

  return (
    <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
      {logo ? (
        <img
          alt=""
          height={56}
          src={logo.src}
          style={{ objectFit: "contain" }}
          width={Math.round((logo.width / logo.height) * 56)}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: colors.accent, fontSize: 30 }}>{siteName}</div>
        {host ? (
          <div style={{ color: colors.muted, fontSize: 22 }}>{host}</div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * The built-in template, registered as `default`: title, description and the
 * site footer on the left, the cover image filling the right third when there
 * is one. Long titles shrink in two steps and stop at three lines.
 */
export const defaultOgImageTemplate = defineOgImageTemplate({
  version: "1",
  render: input => {
    const { colors, cover, description, title } = input;
    const withCover = cover !== null;

    return (
      <div
        style={{
          background: colors.background,
          display: "flex",
          height: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: PADDING,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                background: colors.accent,
                borderRadius: 4,
                display: "flex",
                height: 8,
                width: 96,
              }}
            />
            <div
              style={{
                color: colors.foreground,
                display: "block",
                fontSize: titleSize(title, withCover),
                letterSpacing: -1,
                lineClamp: 3,
                lineHeight: 1.12,
              }}
            >
              {title}
            </div>
            {description ? (
              <div
                style={{
                  color: colors.muted,
                  display: "block",
                  fontSize: 28,
                  lineClamp: withCover ? 3 : 2,
                  lineHeight: 1.4,
                }}
              >
                {description}
              </div>
            ) : null}
          </div>
          <Footer {...input} />
        </div>
        {cover ? (
          <img
            alt=""
            height={630}
            src={cover.src}
            style={{ objectFit: "cover" }}
            width={COVER_WIDTH}
          />
        ) : null}
      </div>
    );
  },
});
