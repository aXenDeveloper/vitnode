import type { ReactElement } from "react";

import type {
  OgImageTemplateLogo,
  OgImageTemplateProps,
  OgImageTheme,
} from "./types";

const TEXT_WIDTH = 880;
const GLOW_SIZE = 1100;

const leadFontSize = (lead: string): number => {
  if (lead.length <= 40) return 64;
  if (lead.length <= 90) return 56;

  return 46;
};

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

const easedFade = (
  color: string,
  strength: number,
  from: number,
  to: number,
): string => {
  const rgb = rgbOf(color);
  if (!rgb) return `${color} ${from}%, transparent ${to}%`;

  return EASED_FADE.map(
    ([at, alpha]) =>
      `rgba(${rgb.join(", ")}, ${(alpha * strength).toFixed(3)}) ${(from + at * (to - from)).toFixed(1)}%`,
  ).join(", ");
};

const clamp = (lines: number) =>
  ({
    display: "block",
    lineClamp: lines,
    overflow: "hidden",
    textOverflow: "ellipsis",
  }) as const;

const OgGlow = ({ theme }: { theme: OgImageTheme }): ReactElement => (
  <>
    <div
      style={{
        background: `radial-gradient(circle at 50% 50%, ${easedFade(theme.accent, 0.9, 0, 70)})`,
        bottom: -GLOW_SIZE / 2 + 40,
        display: "flex",
        height: GLOW_SIZE,
        position: "absolute",
        right: -GLOW_SIZE / 2 + 160,
        width: GLOW_SIZE,
      }}
    />
    <div
      style={{
        background: `radial-gradient(circle at 50% 50%, ${easedFade(theme.accent, 0.5, 0, 70)})`,
        display: "flex",
        height: GLOW_SIZE * 0.7,
        position: "absolute",
        right: -GLOW_SIZE * 0.35,
        top: -GLOW_SIZE * 0.35,
        width: GLOW_SIZE * 0.7,
      }}
    />
  </>
);

const OgBrand = ({
  logo,
  siteName,
}: {
  logo?: OgImageTemplateLogo;
  siteName: string;
}): ReactElement => (
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

const OgText = ({
  category,
  lead,
  secondary,
  theme,
}: {
  category?: string;
  lead: string;
  secondary: null | string;
  theme: OgImageTheme;
}): ReactElement => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 24,
      maxWidth: TEXT_WIDTH,
    }}
  >
    {category ? (
      <span
        style={{
          ...clamp(1),
          color: theme.accent,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        {category}
      </span>
    ) : null}
    <div
      style={{
        ...clamp(secondary ? 3 : 4),
        fontSize: leadFontSize(lead),
        fontWeight: 700,
        letterSpacing: "-0.015em",
        lineHeight: 1.2,
        textWrap: "balance",
      }}
    >
      {lead}
    </div>
    {secondary ? (
      <div
        style={{
          ...clamp(3),
          color: theme.muted,
          fontSize: 30,
          lineHeight: 1.4,
          textWrap: "pretty",
        }}
      >
        {secondary}
      </div>
    ) : null}
  </div>
);

const OgFooter = ({
  avatar,
  domain,
  signature,
  theme,
}: {
  avatar?: OgImageTemplateProps["avatar"];
  domain: string;
  signature: null | string;
  theme: OgImageTheme;
}): ReactElement => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      gap: 20,
      maxWidth: 760,
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
);

/**
 * The card VitNode draws when an app or plugin sets no template of its own.
 * The site's logo heads it, the title is the headline and the description sits
 * under it as secondary text, with the member's avatar on a profile card. The
 * `quote` layout draws the description as a large quote signed with the title
 * instead. A soft glow of `theme.accent` lights the right side.
 */
export const DefaultOgImageTemplate = ({
  avatar,
  category,
  description,
  domain,
  layout = "headline",
  logo,
  siteName,
  theme,
  title,
}: OgImageTemplateProps): ReactElement => {
  const isHeadline = layout === "headline";
  const headline = title || siteName;

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
      <OgGlow theme={theme} />

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
        <OgBrand logo={logo} siteName={siteName} />
        <OgText
          category={category}
          lead={isHeadline ? headline : (description ?? headline)}
          secondary={isHeadline ? description : null}
          theme={theme}
        />
        <OgFooter
          avatar={avatar}
          domain={domain}
          signature={!isHeadline && description ? title : null}
          theme={theme}
        />
      </div>
    </div>
  );
};
