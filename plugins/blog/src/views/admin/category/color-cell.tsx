"use client";

import type { ContentCellProps } from "@vitnode/core/lib/plugin";

import { useTranslations } from "next-intl";

import type { blogCategoryContentType } from "@/content/category";

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
