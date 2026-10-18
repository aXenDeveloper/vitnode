/**
 * The app's name, used in page titles, the default email template and, on the
 * API, as the passkey RP name fallback.
 */
export interface VitNodeMetadata {
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
