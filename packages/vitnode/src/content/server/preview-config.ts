import type { RegisteredContentType } from "../registry";

import { CONFIG } from "../../lib/config";

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
 * Only the origins: the signing key is no longer something a deployment can get
 * wrong, because the install generates one for itself the first time anything
 * asks (see `ensureContentPreviewSecret`). What is left is the half a generated
 * value cannot supply - an unparseable `NEXT_PUBLIC_WEB_URL` means the link
 * that comes back is not a link.
 */
export const contentPreviewConfigProblems = (): string[] => {
  const problems = [
    originProblem("NEXT_PUBLIC_WEB_URL", () => CONFIG.web),
    originProblem("NEXT_PUBLIC_API_URL", () => CONFIG.api),
  ];

  return problems.filter((problem): problem is string => problem !== null);
};

/**
 * Says, at boot, that this install has preview enabled but cannot build a link.
 *
 * Called once, after every plugin's content types are known, because "is
 * preview enabled anywhere" is not answerable before that. An install with no
 * previewable content type is silent - there is nothing to link to.
 *
 * **A warning in every environment, fatal in none.** One content type's opt-in
 * feature must not turn into a boot requirement for the entire API - on the
 * build machine too. Loud rather than silent, though, because the alternative
 * symptom is a 503 from a button somebody clicks three days later.
 */
export const warnAboutContentPreviewConfig = ({
  contentTypes,
}: {
  contentTypes: RegisteredContentType[];
}): void => {
  const previewable = contentTypes.filter(
    entry => entry.definition.editorial.preview.enabled,
  );
  if (previewable.length === 0) return;

  const problems = contentPreviewConfigProblems();
  if (problems.length === 0) return;

  const names = previewable.map(entry => entry.definition.id).join(", ");

  // eslint-disable-next-line no-console
  console.warn(
    `[Content Engine] ${names} ${previewable.length === 1 ? "has" : "have"} \`editorial.preview\` enabled, but preview links cannot be built: ${problems.join(" ")} Preview stays disabled until then.`,
  );
};
