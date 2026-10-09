export type SSOIconSource =
  | { kind: "image"; src: string }
  | { kind: "svg"; markup: string };

const MAX_ICON_LENGTH = 16_384;

const UNSAFE_MARKUP =
  /<\s*(?:script|iframe|foreignobject|object|embed|link|meta|style|handler|set)\b|\son[a-z]+\s*=|javascript:|<!entity|<!doctype/i;

const SVG_MARKUP = /^<svg[\s>][\s\S]*<\/svg\s*>$/i;

const LEADING_PREAMBLE =
  /^(?:<\?xml[\s\S]*?\?>|<!DOCTYPE[^>[]*>|<!--[\s\S]*?-->|\s+)+/i;

const TRAILING_PREAMBLE = /(?:<!--[\s\S]*?-->|\s+)+$/;

const IMAGE_SOURCE =
  /^(?:https?:\/\/|\/(?!\/)|data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,])/i;

const rootElementOf = (value: string): string =>
  value.replace(LEADING_PREAMBLE, "").replace(TRAILING_PREAMBLE, "");

export const ssoIconSource = (icon: unknown): SSOIconSource | undefined => {
  if (typeof icon !== "string") return undefined;

  const value = icon.trim();

  if (!value || value.length > MAX_ICON_LENGTH) return undefined;

  if (value.startsWith("<")) {
    const markup = rootElementOf(value);

    if (!SVG_MARKUP.test(markup) || UNSAFE_MARKUP.test(markup)) {
      return undefined;
    }

    return { kind: "svg", markup };
  }

  return IMAGE_SOURCE.test(value) ? { kind: "image", src: value } : undefined;
};
