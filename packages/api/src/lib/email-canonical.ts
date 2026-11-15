const GOOGLE_MAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

const GOOGLE_CANONICAL_DOMAIN = "gmail.com";

const SUBADDRESS_DOMAINS = new Set([
  "fastmail.com",
  "fastmail.fm",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "icloud.com",
  "mac.com",
  "me.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
]);

const MICROSOFT_CONSUMER_DOMAIN =
  /^(outlook|hotmail|live|msn)\.[a-z]{2,}(\.[a-z]{2,})?$/;

const stripSubaddress = (localPart: string): string => localPart.split("+")[0];

const usesSubaddressing = (domain: string): boolean =>
  SUBADDRESS_DOMAINS.has(domain) || MICROSOFT_CONSUMER_DOMAIN.test(domain);

export const normalizeEmailAddress = (email: string): string =>
  email.trim().toLowerCase();

export const canonicalizeEmail = (email: string): string => {
  const normalized = normalizeEmailAddress(email);
  const separator = normalized.lastIndexOf("@");

  if (separator < 1 || separator === normalized.length - 1) {
    return normalized;
  }

  const localPart = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);

  if (localPart.includes("@") || localPart.startsWith('"')) {
    return normalized;
  }

  if (GOOGLE_MAIL_DOMAINS.has(domain)) {
    const canonicalLocalPart = stripSubaddress(localPart).replaceAll(".", "");

    if (!canonicalLocalPart) {
      return normalized;
    }

    return `${canonicalLocalPart}@${GOOGLE_CANONICAL_DOMAIN}`;
  }

  if (usesSubaddressing(domain)) {
    const canonicalLocalPart = stripSubaddress(localPart);

    if (!canonicalLocalPart) {
      return normalized;
    }

    return `${canonicalLocalPart}@${domain}`;
  }

  return normalized;
};
