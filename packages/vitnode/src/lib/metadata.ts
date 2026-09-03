/** The app's name, as it appears in a browser tab and in an email's subject. */
export interface VitNodeMetadata {
  shortTitle?: string;
  title: string;
}

export const titleTemplate = ({ shortTitle, title }: VitNodeMetadata): string =>
  `%s - ${shortTitle ?? title}`;

/** {@link titleTemplate}, applied to one page's title. */
export const formatPageTitle = (
  metadata: VitNodeMetadata,
  pageTitle: string,
): string => titleTemplate(metadata).replace("%s", pageTitle);
