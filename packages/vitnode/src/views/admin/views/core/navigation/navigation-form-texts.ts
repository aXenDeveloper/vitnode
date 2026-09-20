import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type { NavigationText } from "@/lib/navigation";

/**
 * What the edit dialog shows for a translated field.
 *
 * Stored overrides win. When there are none, the reader's own language is
 * seeded with the text the item renders with today - the built-in default of a
 * prebuilt page - so the dialog opens showing what is live rather than an empty
 * box next to a placeholder.
 */
export const prefillNavigationText = ({
  fallback,
  locale,
  stored,
}: {
  fallback?: string;
  locale: string;
  stored: readonly NavigationText[];
}): MultiLangValue => {
  if (stored.length > 0) return stored.map(item => ({ ...item }));

  const seed = fallback?.trim();

  return seed ? [{ languageCode: locale, value: seed }] : [];
};

/**
 * The same field on the way back out, with anything still equal to the
 * built-in default removed.
 *
 * Seeding the box above would otherwise turn every opened-and-saved dialog into
 * a stored override, and a prebuilt item that holds its own copy of the title
 * stops following the plugin that renames the page.
 */
export const stripDefaultNavigationText = ({
  fallback,
  values,
}: {
  fallback?: string;
  values: readonly NavigationText[];
}): MultiLangValue => {
  const seed = fallback?.trim();

  return values.filter(item => {
    const value = item.value.trim();

    return value !== "" && value !== seed;
  });
};

/** Whether the admin has put something of their own in a translated field. */
const isOwnText = (
  values: readonly NavigationText[],
  fallback?: string,
): boolean =>
  values.some(item => {
    const value = item.value.trim();

    return value !== "" && value !== fallback?.trim();
  });

/**
 * What a field becomes when a different prebuilt page is picked, or
 * `undefined` to leave it as it is.
 *
 * Choosing a page fills in what it is called, which is what makes the dialog
 * usable - but only over a box that is still empty or still holds the previous
 * page's own words. Anything typed here belongs to the admin and survives.
 */
export const autofillNavigationText = ({
  locale,
  nextFallback,
  previousFallback,
  values,
}: {
  locale: string;
  nextFallback?: string;
  previousFallback?: string;
  values: readonly NavigationText[];
}): MultiLangValue | undefined =>
  isOwnText(values, previousFallback)
    ? undefined
    : prefillNavigationText({ fallback: nextFallback, locale, stored: [] });

/** {@link autofillNavigationText}, for the icon, which is one string. */
export const autofillNavigationIcon = ({
  icon,
  nextIcon,
  previousIcon,
}: {
  icon: string;
  nextIcon?: null | string;
  previousIcon?: null | string;
}): string | undefined =>
  icon.trim() === "" || icon === previousIcon ? (nextIcon ?? "") : undefined;
