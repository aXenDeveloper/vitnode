import type { CSSProperties } from "react";

import { glideSidebarIndicators } from "@vitnode/core/components/ui/sidebar-glide";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import type { BlogCategory } from "./blog-queries";

import { BlogCategorySwatch, categoryBorder, categoryStyle } from "./blog-card";
import {
  blogCategoriesTransition,
  switchBlogCategory,
} from "./blog-transitions";

interface BlogCategoryNavProps {
  categories: BlogCategory[];
  categoryHref: (category: BlogCategory | undefined) => string;
  selected: number | undefined;
  total: number;
}

const visibleCategories = ({ categories, selected }: BlogCategoryNavProps) =>
  categories.filter(
    category => category.articleCount > 0 || category.id === selected,
  );

const SLIDE_WINDOW_MS = 1000;

let lastActive: null | {
  at: number;
  height: string;
  translate: string;
  width: string;
} = null;

export const BlogCategorySidebar = (props: BlogCategoryNavProps) => {
  const t = useTranslations("@vitnode/blog.list");
  const { categories, categoryHref, selected, total } = props;
  const glideRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const active = categories.find(category => category.id === selected);

  React.useEffect(() => {
    const area = glideRef.current;
    const indicator = activeRef.current;
    if (!area || !indicator) return;

    if (lastActive && Date.now() - lastActive.at < SLIDE_WINDOW_MS) {
      indicator.style.transitionProperty = "none";
      indicator.style.translate = lastActive.translate;
      indicator.style.width = lastActive.width;
      indicator.style.height = lastActive.height;
      indicator.style.opacity = "1";
      indicator.getBoundingClientRect();
      indicator.style.transitionProperty = "";
    }

    return glideSidebarIndicators(area);
  }, []);

  const rememberActive = () => {
    switchBlogCategory(navRef.current);
    const indicator = activeRef.current;
    if (!indicator) return;

    lastActive = {
      at: Date.now(),
      height: indicator.style.height,
      translate: indicator.style.translate,
      width: indicator.style.width,
    };
  };

  return (
    <nav
      aria-labelledby="blog-categories"
      className="flex flex-col gap-3"
      ref={navRef}
      style={blogCategoriesTransition()}
    >
      <h2
        className="text-foreground text-sm font-semibold"
        id="blog-categories"
      >
        {t("categories")}
      </h2>
      <div
        className="group/blog-nav relative"
        ref={glideRef}
        style={
          {
            ...categoryStyle(active),
            "--blog-active": active
              ? "color-mix(in oklch, var(--blog-category) 14%, transparent)"
              : "var(--muted)",
          } as CSSProperties
        }
      >
        <span
          aria-hidden="true"
          className="bg-accent ease-fluid pointer-events-none absolute top-0 left-0 rounded-lg opacity-0 transition-[translate,width,height,opacity,scale] duration-200 data-hidden:duration-150 data-pressed:scale-98 motion-reduce:transition-opacity"
          data-sidebar="hover-indicator"
        />
        <span
          aria-hidden="true"
          className="ease-fluid pointer-events-none absolute top-0 left-0 rounded-lg bg-(--blog-active) opacity-0 transition-[translate,width,height,scale,background-color] duration-300 data-pressed:scale-98 motion-reduce:transition-none"
          data-sidebar="active-indicator"
          ref={activeRef}
        />
        <ul className="flex flex-col gap-1">
          {[undefined, ...visibleCategories(props)].map(category => {
            const isActive = selected === category?.id;
            const count = category ? category.articleCount : total;

            return (
              <li key={category?.id ?? "all"}>
                <HrefLink
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group/item relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm leading-snug transition-[background-color,color,scale] active:scale-98",
                    isActive
                      ? "text-foreground bg-(--blog-active)"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    "group-data-glide/blog-nav:bg-transparent group-data-glide/blog-nav:hover:bg-transparent group-data-glide/blog-nav:active:scale-100",
                  )}
                  data-active={isActive ? "" : undefined}
                  data-sidebar="menu-button"
                  href={categoryHref(category)}
                  onClick={rememberActive}
                  preload="viewport"
                >
                  <BlogCategorySwatch category={category} />
                  <span className="flex-1">
                    {category?.name ?? t("all_articles")}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums transition-colors",
                      isActive
                        ? "bg-card text-foreground"
                        : "bg-muted text-muted-foreground group-hover/item:bg-card",
                    )}
                  >
                    <span aria-hidden="true">{count}</span>
                    <span className="sr-only">
                      {t("article_count", { count })}
                    </span>
                  </span>
                </HrefLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export const BlogCategoryChips = (props: BlogCategoryNavProps) => {
  const t = useTranslations("@vitnode/blog.list");
  const { categoryHref, selected } = props;

  return (
    <nav
      aria-label={t("categories")}
      className="-mx-4 overflow-x-auto px-4 pb-1"
    >
      <ul className="flex w-max gap-2">
        {[undefined, ...visibleCategories(props)].map(category => {
          const isActive = selected === category?.id;

          return (
            <li key={category?.id ?? "all"}>
              <HrefLink
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-[background-color,color,border-color] duration-150 ease-out before:absolute before:inset-x-0 before:-inset-y-1",
                  isActive
                    ? "bg-card text-foreground"
                    : "bg-card/60 text-muted-foreground border-border hover:text-foreground",
                )}
                href={categoryHref(category)}
                preload="viewport"
                style={{
                  ...categoryStyle(category),
                  ...(isActive
                    ? {
                        borderColor: category
                          ? categoryBorder
                          : "color-mix(in oklch, var(--foreground) 35%, transparent)",
                      }
                    : {}),
                }}
              >
                <BlogCategorySwatch category={category} />
                {category?.name ?? t("all_articles")}
              </HrefLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
