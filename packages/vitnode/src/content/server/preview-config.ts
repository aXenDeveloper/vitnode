import type { RegisteredContentType } from "../registry";

import {
  CONFIG,
  CONTENT_PREVIEW_SECRET_MIN_BYTES,
  INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET,
  isSecureContentPreviewSecret,
} from "../../lib/config";
import { ContentEngineError } from "../errors";

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
 * Whether this process is `next build` collecting page data rather than a
 * server about to answer requests.
 *
 * Next imports every route module during a production build, so the API's boot
 * code runs there too - and a build machine has no business holding a runtime
 * signing secret. Failing the build would push every install to bake its
 * secrets into an image, which is a worse outcome than the one being prevented.
 * The serving process still refuses to start, which is where it matters.
 */
const isBuildPhase = (): boolean =>
  process.env.NEXT_PHASE === "phase-production-build";

/**
 * Refuses to boot a production install whose preview links would be forgeable.
 *
 * Called once, after every plugin's content types are known, because "is
 * preview enabled anywhere" is not answerable before that. An install with no
 * previewable content type is unaffected - there is nothing to sign.
 *
 * **Production refuses to start; development starts with preview switched
 * off.** The reasoning is the same in both cases and only the blast radius
 * differs: a signature is the *entire* access control on a preview link, so a
 * well-known secret is not a warning, it is unpublished content served to
 * anyone who reads the VitNode source. Failing at deploy time is far kinder
 * than shipping a feature that quietly hands drafts out; failing at `pnpm dev`
 * time would be rude, so there the routes fail closed instead and say why.
 */
export const assertContentPreviewConfig = ({
  contentTypes,
  isProduction = process.env.NODE_ENV === "production" && !isBuildPhase(),
  secret,
}: {
  contentTypes: RegisteredContentType[];
  isProduction?: boolean;
  secret: null | string | undefined;
}): void => {
  const previewable = contentTypes.filter(
    entry => entry.definition.editorial.preview.enabled,
  );
  if (previewable.length === 0) return;

  const problems = contentPreviewConfigProblems(secret);
  if (problems.length === 0) return;

  const names = previewable.map(entry => entry.definition.id).join(", ");
  const message = `${names} ${previewable.length === 1 ? "has" : "have"} \`editorial.preview\` enabled, but preview is not safe to serve: ${problems.join(" ")} ${HOW_TO_FIX}`;

  if (isProduction) throw new ContentEngineError(message);

  // Not fatal outside a serving production process, but not silent either:
  // without this the only symptom is a 503 from a button somebody clicks three
  // days later.
  // eslint-disable-next-line no-console
  console.warn(
    `[Content Engine] ${message} Preview stays disabled until then.`,
  );
};
