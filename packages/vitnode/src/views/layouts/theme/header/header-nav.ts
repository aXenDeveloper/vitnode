export interface HeaderLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

export type HeaderLinkComponent = (props: HeaderLinkProps) => React.ReactNode;

/** Where the main header points. Internal paths, with no locale prefix in them. */
export const HEADER_HREF = {
  discover: "/discover",
  home: "/",
  search: "/search",
} as const;

export const HEADER_NAV_MESSAGE_KEYS = {
  discover: "nav.discover",
  search: "nav.search",
} as const;

/** One link in the main nav. */
export interface HeaderNavItem {
  href: string;
  label: string;
}

/** The labels {@link headerNavItems} needs, already translated. */
export interface HeaderNavLabels {
  discover: string;
  search: string;
}

export const headerNavItems = ({
  discover,
  search,
}: HeaderNavLabels): HeaderNavItem[] => [
  { href: HEADER_HREF.discover, label: discover },
  { href: HEADER_HREF.search, label: search },
];
