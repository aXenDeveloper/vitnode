/**
 * The app's name, used in page titles, the default email template and, on the
 * API, as the passkey RP name fallback.
 */
export interface VitNodeMetadata {
  /**
   * A sentence about the site. The site's social card shows it under the
   * title. Optional.
   */
  description?: string;
  /**
   * The `og:image` of pages that set none of their own. Defaults to
   * `"generated"`: the site card the API draws at
   * `/api/@vitnode/core/og/site`. A URL uses that image instead; `false` emits
   * no default image. Read by the web app only.
   */
  ogImage?: false | string;
  /**
   * A shorter name for page titles (`{page} - {shortTitle}`), the email
   * footer and the passkey RP name. Defaults to `title`.
   */
  shortTitle?: string;
  /**
   * The full name. The default email header shows it (or uses it as the logo
   * image's alt text) when the email logo sets no `text`.
   */
  title: string;
}

/** The page title template, `%s - {shortTitle ?? title}`. */
export const titleTemplate = ({ shortTitle, title }: VitNodeMetadata): string =>
  `%s - ${shortTitle ?? title}`;

/** {@link titleTemplate}, applied to one page's title. */
export const formatPageTitle = (
  metadata: VitNodeMetadata,
  pageTitle: string,
): string => titleTemplate(metadata).replace("%s", pageTitle);
