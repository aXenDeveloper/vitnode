const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;
const CREDENTIAL_PAIR = /(key|token|secret|password|authorization)=[^\s&]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

/**
 * Masks the values that most often leak into an error message - addresses,
 * `secret=...` pairs and bearer tokens - before it is logged or stored.
 */
export const redactSecrets = (text: string): string =>
  text
    .replace(EMAIL, "[email]")
    .replace(CREDENTIAL_PAIR, "$1=[redacted]")
    .replace(BEARER, "Bearer [redacted]");
