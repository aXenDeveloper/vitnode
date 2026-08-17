"use client";

import type { ContentCellProps } from "@vitnode/core/lib/plugin";

import { useTranslations } from "next-intl";

import type { blogCategoryContentType } from "@/content/category";

/**
 * The colour column, as a swatch **and** the value it stands for.
 *
 * The text is not decoration. A cell that communicated the colour only visually
 * would be unreadable to a screen reader and ambiguous to anyone who cannot tell
 * two blues apart, so the swatch is `aria-hidden` and the value next to it is
 * the accessible content.
 *
 * A column override, so none of this reasoning lands in the generic content
 * table - which knows about kinds, not about colours.
 */
export const BlogCategoryColorCell = ({
  row,
}: ContentCellProps<typeof blogCategoryContentType>) => {
  const t = useTranslations("@vitnode/blog.admin.category");
  const color = row.color;

  if (!color) {
    return <span className="text-muted-foreground">{t("color.none")}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-full border"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground truncate text-sm">{color}</span>
    </div>
  );
};
