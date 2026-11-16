/**
 * The stored form of a session token: SHA-256, lowercase hex.
 *
 * A session cookie carries the token; the row holds only this. Both session
 * models write and look up rows through it, so the two cannot disagree about
 * what a stored token looks like. Web Crypto, hence async - there is no
 * synchronous digest in this runtime.
 */
export const hashSessionToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);

  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }

  return result;
};
