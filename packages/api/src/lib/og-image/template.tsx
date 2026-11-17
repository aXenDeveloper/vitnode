import type { ReactElement } from "react";

import type { OgImageTemplateProps } from "./types";

/** The cover fills the right side, sharp; the quote keeps the left. */
const COVER_WIDTH = 820;
/**
 * Where, in percent of the cover's width, it starts to show and where it is
 * fully visible: solid under the whole quote column (which ends 620 px in),
 * then a long eased fade, so the cover never sits under a word.
 */
const FADE_FROM = 29;
const FADE_TO = 92;
/** The quote's column when a cover is beside it, so no word sits on the picture. */
const QUOTE_WIDTH_WITH_COVER = 540;

const quoteSize = (quote: string, narrow: boolean): number => {
  if (quote.length <= 40) return narrow ? 54 : 64;
  if (quote.length <= 90) return narrow ? 44 : 56;

  return narrow ? 38 : 46;
};

/**
 * Opacity along an S-curve fade (smoothstep): it starts and ends so gently
 * that neither end of the fade shows as an edge, which a linear gradient - or
 * a curve that drops fastest at its start - does.
 */
const EASED_FADE: readonly (readonly [number, number])[] = Array.from(
  { length: 17 },
  (_, step) => {
    const at = step / 16;

    return [at, 1 - at * at * (3 - 2 * at)] as const;
  },
);

const rgbOf = (color: string): [number, number, number] | null => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return null;
  const full =
    hex.length === 3 ? [...hex].map(digit => digit + digit).join("") : hex;

  return [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
};

/** `color` fading to transparent between `from` and `to` (percent), eased when the colour is hex. */
const easedFade = (color: string, from: number, to: number): string => {
  const rgb = rgbOf(color);
  if (!rgb) return `${color} ${from}%, transparent ${to}%`;

  return EASED_FADE.map(
    ([at, alpha]) =>
      `rgba(${rgb.join(", ")}, ${alpha.toFixed(3)}) ${(from + at * (to - from)).toFixed(1)}%`,
  ).join(", ");
};

const clamp = (lines: number) =>
  ({
    display: "block",
    lineClamp: lines,
    overflow: "hidden",
    textOverflow: "ellipsis",
  }) as const;

/**
 * The card VitNode draws when an app or plugin sets no template of its own: a
 * pull quote. The site's logo heads it, the description is the quote and the
 * title signs it, with the member's avatar on a profile card. A
 * record's cover (or a member's profile cover) fills the right side, sharp,
 * and fades into the background behind the quote, which keeps to its own
 * column so no word sits on the picture.
 */
export const DefaultOgImageTemplate = ({
  avatar,
  description,
  domain,
  image,
  logo,
  siteName,
  theme,
  title,
}: OgImageTemplateProps): ReactElement => {
  const quote = description ?? (title || siteName);
  const signature = description ? title : null;
  // The logo (and the site name beside a logo that does not spell it) heads
  // the card top left, on the plain background - never on a cover.
  const brand = (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        gap: 16,
      }}
    >
      {logo ? (
        <img
          alt=""
          height={logo.height}
          src={logo.src}
          style={{ height: logo.height, width: logo.width }}
          width={logo.width}
        />
      ) : null}
      {logo?.wordmark ? null : (
        <span
          style={{
            ...clamp(1),
            fontSize: 30,
            fontWeight: 700,
            maxWidth: 640,
          }}
        >
          {siteName}
        </span>
      )}
    </div>
  );

  return (
    <div
      style={{
        background: theme.background,
        color: theme.foreground,
        display: "flex",
        fontFamily: theme.fontFamily,
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      {image ? (
        <img
          alt=""
          height={630}
          src={image.src}
          style={{
            // A touch darker, so a bright cover never washes out the text
            // where the fade lets it through.
            filter: "brightness(0.82)",
            height: 630,
            objectFit: "cover",
            position: "absolute",
            right: 0,
            top: 0,
            width: COVER_WIDTH,
          }}
          width={COVER_WIDTH}
        />
      ) : null}
      {image ? (
        // A long eased fade from the end of the quote column: the cover melts
        // into the background instead of meeting the text at an edge.
        <div
          style={{
            background: `linear-gradient(90deg, ${theme.background} 0%, ${easedFade(theme.background, FADE_FROM, FADE_TO)})`,
            display: "flex",
            height: "100%",
            position: "absolute",
            right: 0,
            top: 0,
            width: COVER_WIDTH,
          }}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 80px 56px",
          position: "relative",
          width: "100%",
        }}
      >
        {brand}

        <div
          style={{
            ...clamp(image ? 5 : 4),
            fontSize: quoteSize(quote, image !== undefined),
            maxWidth: image ? QUOTE_WIDTH_WITH_COVER : undefined,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
            textWrap: "balance",
          }}
        >
          {quote}
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 32,
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 20,
              maxWidth: image ? QUOTE_WIDTH_WITH_COVER : 760,
            }}
          >
            {avatar ? (
              <div
                style={{
                  alignItems: "center",
                  background: avatar.color,
                  borderRadius: 9999,
                  color: "#ffffff",
                  display: "flex",
                  flexShrink: 0,
                  fontSize: 34,
                  fontWeight: 700,
                  height: 72,
                  justifyContent: "center",
                  width: 72,
                }}
              >
                {avatar.initial}
              </div>
            ) : (
              <div
                style={{
                  background: theme.accent,
                  display: "flex",
                  flexShrink: 0,
                  height: 3,
                  width: 48,
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {signature ? (
                <span style={{ ...clamp(1), fontSize: 28, fontWeight: 700 }}>
                  {signature}
                </span>
              ) : null}
              <span style={{ color: theme.muted, fontSize: 22 }}>{domain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
