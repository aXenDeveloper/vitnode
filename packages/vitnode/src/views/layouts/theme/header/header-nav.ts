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

/** One link inside a nav dropdown. */
export interface HeaderNavChildItem {
  description?: string;
  href: string;
  label: string;
}

/** One entry in the main nav - a link, or a dropdown when it carries `items`. */
export interface HeaderNavItem {
  href: string;
  items?: HeaderNavChildItem[];
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
