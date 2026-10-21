import type { CSSProperties } from "react";

import { Avatar } from "@vitnode/core/components/avatar";
import { HiddenIcon } from "@vitnode/core/components/hidden-icon";
import { resolveImageAlt } from "@vitnode/core/lib/files/resolve-alt";
import { getIntlRuntime } from "@vitnode/core/tanstack/i18n";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { cn } from "cn";
import { ImageIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import type { BlogCategory, BlogPostCardData } from "./blog-queries";

import { blogPostHref } from "./blog-post-href";
import {
  blogCardCoverTransition,
  blogCardTitleTransition,
  morphBlogCard,
} from "./blog-transitions";

type Categories = ReadonlyMap<number, BlogCategory>;

export const categoryStyle = (
  category: BlogCategory | undefined,
): CSSProperties =>
  ({
    "--blog-category": category
      ? (category.color ?? "var(--muted-foreground)")
      : "var(--foreground)",
  }) as CSSProperties;

export const categoryBorder =
  "color-mix(in oklch, var(--blog-category) 85%, var(--foreground) 15%)";

export const BlogCategorySwatch = ({
  category,
  className,
}: {
  category?: BlogCategory;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "ring-foreground/15 size-3 shrink-0 rounded-xs bg-(--blog-category) ring-1 ring-inset",
      className,
    )}
    style={categoryStyle(category)}
  />
);

const tag =
  "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-medium";

const BlogCategoryTags = ({
  categories,
  max,
  onImage = false,
  post,
}: {
  categories: Categories;
  max: number;
  onImage?: boolean;
  post: BlogPostCardData;
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const labels = post.categoryId.flatMap(id => {
    const category = categories.get(id);

    return category ? [category] : [];
  });
  if (labels.length === 0) return null;

  const hidden = labels.length - max;

  return (
    <ul aria-label={t("categories")} className="flex min-w-0 flex-wrap gap-1.5">
      {labels.slice(0, max).map(category => (
        <li className="max-w-full" key={category.id}>
          <span
            className={cn(
              tag,
              onImage
                ? "bg-black/55 text-white backdrop-blur-sm"
                : "text-foreground",
            )}
            style={{
              ...categoryStyle(category),
              borderColor: onImage ? "var(--blog-category)" : categoryBorder,
            }}
          >
            <BlogCategorySwatch
              category={category}
              className={onImage ? "ring-white/25" : undefined}
            />
            <span className="truncate">{category.name}</span>
          </span>
        </li>
      ))}
      {hidden > 0 ? (
        <li
          className={cn(
            tag,
            "tabular-nums",
            onImage
              ? "border-white/30 bg-black/55 text-white backdrop-blur-sm"
              : "border-border text-muted-foreground",
          )}
        >
          <span aria-hidden="true">+{hidden}</span>
          <span className="sr-only">
            {t("more_categories", { count: hidden })}
          </span>
        </li>
      ) : null}
    </ul>
  );
};

const BlogPostByline = ({
  className,
  post,
  ringClassName,
  size = 24,
}: {
  className?: string;
  post: BlogPostCardData;
  ringClassName: string;
  size?: number;
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const format = useFormatter();
  const { authorId: authors } = post;
  const [first, second] = authors;
  const authorsLabel =
    authors.length === 2
      ? t("authors_two", { first: first.name, second: second.name })
      : authors.length > 2
        ? t("authors_many", { count: authors.length - 1, first: first.name })
        : first?.name;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm leading-relaxed",
        className,
      )}
    >
      {authors.length > 0 ? (
        <>
          <span className="flex min-w-0 items-center gap-2">
            <span className="isolate flex shrink-0">
              {authors.map((author, index) => (
                <Avatar
                  alt=""
                  className={cn(
                    "relative ring-2",
                    ringClassName,
                    index > 0 && "-ms-2",
                  )}
                  key={author.id}
                  size={size}
                  style={{ zIndex: authors.length - index }}
                  user={author}
                />
              ))}
            </span>
            <span className="truncate">
              <span className="sr-only">{t("by")} </span>
              {authorsLabel}
            </span>
          </span>
          {post.publishedAt ? <span aria-hidden="true">·</span> : null}
        </>
      ) : null}
      {post.publishedAt ? (
        <span className="shrink-0 tabular-nums">
          <span className="sr-only">{t("published")} </span>
          <time dateTime={new Date(post.publishedAt).toISOString()}>
            {format.dateTime(new Date(post.publishedAt), {
              dateStyle: "medium",
            })}
          </time>
        </span>
      ) : null}
    </div>
  );
};

const BlogPostCover = ({
  className,
  isPriority = false,
  post,
  sizes,
  style,
  ...props
}: {
  className?: string;
  "data-blog-cover"?: string;
  isPriority?: boolean;
  post: BlogPostCardData;
  sizes: string;
  style?: CSSProperties;
}) => (
  <div
    className={cn("bg-muted isolate overflow-hidden", className)}
    style={style}
    {...props}
  >
    {post.coverImage ? (
      <img
        alt={
          resolveImageAlt({
            alts: post.coverImage.alts,
            fallbackLocales: [getIntlRuntime().defaultLocale],
            locale: post.locale,
            occurrence: { alt: post.coverImageAlt },
          }).alt
        }
        className="size-full object-cover outline-1 -outline-offset-1 outline-black/10 transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none dark:outline-white/10"
        decoding="async"
        fetchPriority={isPriority ? "high" : undefined}
        height={post.coverImage.height}
        loading={isPriority ? "eager" : "lazy"}
        sizes={sizes}
        src={post.coverImage.url}
        width={post.coverImage.width}
      />
    ) : (
      <div
        aria-hidden="true"
        className="text-muted-foreground/50 flex size-full items-center justify-center select-none"
      >
        <ImageIcon className="size-8" strokeWidth={1.5} />
      </div>
    )}
  </div>
);

const PostHiddenIcon = ({
  className,
  post,
}: {
  className?: string;
  post: BlogPostCardData;
}) => {
  const t = useTranslations("@vitnode/blog.list");

  return post.hidden ? (
    <HiddenIcon
      className={cn("relative z-10 me-1.5 align-middle", className)}
      label={t("hidden")}
    />
  ) : null;
};

const PostTitleLink = ({
  className,
  post,
}: {
  className?: string;
  post: BlogPostCardData;
}) => (
  <HrefLink
    className={cn(
      "underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
      className,
    )}
    href={blogPostHref(post.friendlyUrl)}
    onClick={event => {
      morphBlogCard(event.currentTarget, post.id);
    }}
    preload="viewport"
  >
    {post.title}
  </HrefLink>
);

const cardFocus =
  "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-background has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-offset-2";

export const BlogPostTile = ({
  categories,
  className,
  isLead = false,
  post,
}: {
  categories: Categories;
  className?: string;
  isLead?: boolean;
  post: BlogPostCardData;
}) => {
  const locale = useLocale();

  return (
    <article
      className={cn(
        "group relative isolate flex aspect-video overflow-hidden rounded-xl bg-black",
        cardFocus,
        className,
      )}
      lang={post.locale === locale ? undefined : post.locale}
    >
      <BlogPostCover
        className="absolute inset-0 -z-10"
        data-blog-cover=""
        isPriority={isLead}
        post={post}
        sizes={
          isLead
            ? "(min-width: 64rem) 52rem, 100vw"
            : "(min-width: 64rem) 26rem, (min-width: 40rem) 33vw, 100vw"
        }
        style={blogCardCoverTransition(post.id)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/40 to-black/0"
      />
      <div className="flex w-full min-w-0 flex-col justify-between gap-4 p-4 md:p-5">
        <BlogCategoryTags
          categories={categories}
          max={isLead ? 3 : 2}
          onImage
          post={post}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <h3
            className={cn(
              "font-semibold tracking-tight text-balance text-white",
              isLead
                ? "line-clamp-2 text-xl md:line-clamp-3 md:text-4xl"
                : "line-clamp-2 text-lg leading-snug",
            )}
            data-blog-title=""
            style={blogCardTitleTransition(post.id)}
          >
            <PostHiddenIcon
              className={isLead ? "size-5 md:size-8" : "size-4"}
              post={post}
            />
            <PostTitleLink className="decoration-white/40" post={post} />
          </h3>
          {isLead && post.excerpt ? (
            <p className="hidden max-w-2xl text-sm leading-relaxed text-pretty text-white/75 md:line-clamp-2">
              {post.excerpt}
            </p>
          ) : null}
          <BlogPostByline
            className="text-white/80"
            post={post}
            ringClassName="ring-black/40"
            size={isLead ? 28 : 24}
          />
        </div>
      </div>
    </article>
  );
};

/**
 * One article in the `/blog` list: its cover beside up to three categories,
 * the title, the excerpt when it has one, and its authors and date. The whole
 * card is the link; the title is its accessible name.
 */
export const BlogPostCard = ({
  categories,
  post,
}: {
  categories: Categories;
  post: BlogPostCardData;
}) => {
  const locale = useLocale();

  return (
    <article
      className={cn(
        "group bg-card text-card-foreground relative grid grid-cols-1 gap-4 rounded-2xl p-2 shadow-xs ring-1 ring-black/5 transition-shadow duration-150 ease-out hover:shadow-md hover:ring-black/10 sm:grid-cols-[16rem_1fr] sm:gap-6 md:grid-cols-[18rem_1fr] dark:ring-white/10 dark:hover:ring-white/20",
        cardFocus,
      )}
      lang={post.locale === locale ? undefined : post.locale}
    >
      <div
        className="relative isolate overflow-hidden rounded-lg"
        data-blog-cover=""
        style={blogCardCoverTransition(post.id)}
      >
        <div aria-hidden="true" className="aspect-video" />
        <BlogPostCover
          className="absolute inset-0"
          post={post}
          sizes="(min-width: 48rem) 18rem, (min-width: 40rem) 16rem, 100vw"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-2 sm:py-3 sm:pe-4">
        <BlogCategoryTags categories={categories} max={3} post={post} />
        <h3
          className="text-foreground line-clamp-3 text-lg leading-snug font-semibold tracking-tight text-balance md:text-xl"
          data-blog-title=""
          style={blogCardTitleTransition(post.id)}
        >
          <PostHiddenIcon className="size-5" post={post} />
          <PostTitleLink className="decoration-foreground/30" post={post} />
        </h3>
        {post.excerpt ? (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed text-pretty">
            {post.excerpt}
          </p>
        ) : null}
        <BlogPostByline
          className="text-muted-foreground mt-auto pt-1"
          post={post}
          ringClassName="ring-card"
        />
      </div>
    </article>
  );
};
