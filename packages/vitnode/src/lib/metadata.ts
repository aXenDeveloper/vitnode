/** The app's name, as it appears in a browser tab and in an email's subject. */
export interface VitNodeMetadata {
  /**
   * A shorter name for places the full one does not fit - most of all the tab
   * title of every page but the first, where it follows the page's own name.
   * Falls back to {@link VitNodeMetadata.title}.
   */
  shortTitle?: string;
  title: string;
}

/**
 * The tab title of a page, as `"<page> - <site>"`.
 *
 * `%s` is Next.js' placeholder for the page's own title, and Next.js is the one
 * that does the substitution - `generateMetadataRootLayout` hands it this string
 * as `title.template`. Frameworks without that mechanism call
 * {@link formatPageTitle} instead, so both produce the same title and the rule
 * lives in one place.
 */
export const titleTemplate = ({ shortTitle, title }: VitNodeMetadata): string =>
  `%s - ${shortTitle ?? title}`;

/** {@link titleTemplate}, applied to one page's title. */
export const formatPageTitle = (
  metadata: VitNodeMetadata,
  pageTitle: string,
): string => titleTemplate(metadata).replace("%s", pageTitle);
