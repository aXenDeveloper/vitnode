import type { RegisteredContentType } from "../registry";

import {
  CONFIG,
  CONTENT_PREVIEW_SECRET_MIN_BYTES,
  INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET,
  isSecureContentPreviewSecret,
} from "../../lib/config";

/**
 * The sentence a person needs to fix an unusable preview secret.
 *
 * `null` when the secret is fine. Three distinct reasons rather than one,
 * because "you have not set it" and "you set it to twelve characters" call for
 * different reactions, and a single "misconfigured" would hide which.
 */
export const contentPreviewSecretProblem = (
  secret: null | string | undefined,
): null | string => {
  if (isSecureContentPreviewSecret(secret)) return null;

  if (secret === undefined || secret === null || secret === "") {
    return "CONTENT_PREVIEW_SECRET is not set.";
  }

  if (secret === INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET) {
    return "CONTENT_PREVIEW_SECRET is still the built-in placeholder, which is published in the VitNode source.";
  }

  return `CONTENT_PREVIEW_SECRET is shorter than ${CONTENT_PREVIEW_SECRET_MIN_BYTES} bytes.`;
};

/** Whether a configured origin is a URL the preview link builder can use. */
const originProblem = (name: string, read: () => URL): null | string => {
  try {
    read();

    return null;
  } catch {
    return `${name} is not a valid absolute URL, so preview links cannot be built.`;
  }
};

/**
 * Everything standing between this install and a working preview link.
 *
 * Both halves matter and both are checked here rather than at the point of use:
 * an unusable secret means anyone can mint their own token, and an unparseable
 * `NEXT_PUBLIC_WEB_URL` means the link that comes back is not a link.
 */
export const contentPreviewConfigProblems = (
  secret: null | string | undefined,
): string[] => {
  const problems = [
    contentPreviewSecretProblem(secret),
    originProblem("NEXT_PUBLIC_WEB_URL", () => CONFIG.web),
    originProblem("NEXT_PUBLIC_API_URL", () => CONFIG.api),
  ];

  return problems.filter((problem): problem is string => problem !== null);
};

const HOW_TO_FIX =
  "Generate one with `openssl rand -base64 32` (or `node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"`) and set it on every process that serves the API.";

/**
 * Says, at boot, that this install has preview enabled but cannot serve it.
 *
 * Called once, after every plugin's content types are known, because "is
 * preview enabled anywhere" is not answerable before that. An install with no
 * previewable content type is silent - there is nothing to sign.
 *
 * **A warning in every environment, fatal in none.**
 * `CONTENT_PREVIEW_SECRET` is optional: an install that never sends anyone a
 * preview link has no reason to hold a signing key, and refusing to boot would
 * turn one content type's opt-in feature into a deployment prerequisite for the
 * entire API - on the build machine too, which has no business holding a runtime
 * secret. What switches off is preview, and it switches off completely: minting
 * a link answers 503 naming the variable, reading one answers the same 404 a
 * forged token gets, and the integrations panel flags the install as insecure.
 *
 * Loud rather than silent, though, because the alternative symptom is a 503 from
 * a button somebody clicks three days later.
 */
export const warnAboutContentPreviewConfig = ({
  contentTypes,
  secret,
}: {
  contentTypes: RegisteredContentType[];
  secret: null | string | undefined;
}): void => {
  const previewable = contentTypes.filter(
    entry => entry.definition.editorial.preview.enabled,
  );
  if (previewable.length === 0) return;

  const problems = contentPreviewConfigProblems(secret);
  if (problems.length === 0) return;

  const names = previewable.map(entry => entry.definition.id).join(", ");

  // eslint-disable-next-line no-console
  console.warn(
    `[Content Engine] ${names} ${previewable.length === 1 ? "has" : "have"} \`editorial.preview\` enabled, but preview is not safe to serve: ${problems.join(" ")} ${HOW_TO_FIX} Preview stays disabled until then.`,
  );
};
