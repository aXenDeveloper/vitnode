import { DateFormat } from "@vitnode/core/components/date-format";
import { contentDeliveryInternalPath } from "@vitnode/core/content";
import { resolveImageAlt } from "@vitnode/core/lib/files/resolve-alt";
import { getIntlRuntime } from "@vitnode/core/tanstack/i18n";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { useLocale, useTranslations } from "use-intl";

import { blogPostContentType } from "@/content/post";

import type { BlogCategory, BlogPostCardData } from "./blog-queries";

/** The article's own page, before the reader's locale prefix. */
export const blogPostHref = (slug: string): string =>
  contentDeliveryInternalPath({ definition: blogPostContentType, slug }) ??
  `/blog/${encodeURIComponent(slug)}`;

/** A category's name with its colour as a dot - the colour is never the only cue. */
export const BlogCategoryLabel = ({ category }: { category: BlogCategory }) => (
  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm leading-relaxed">
    <span
      aria-hidden="true"
      className="bg-muted-foreground size-2 shrink-0 rounded-full"
      style={category.color ? { backgroundColor: category.color } : undefined}
    />
    {category.name}
  </span>
);

/**
 * One article on `/blog`: cover, categories, title, excerpt and date. The
 * title is the only link, so a keyboard or screen-reader user meets each
 * article once.
 */
export const BlogPostCard = ({
  categories,
  isPriority = false,
  post,
}: {
  /** Every category by id; ids with no match (a just-deleted one) are skipped. */
  categories: ReadonlyMap<number, BlogCategory>;
  /** The first row of the first page: loaded eagerly, it is the likely LCP. */
  isPriority?: boolean;
  post: BlogPostCardData;
}) => {
  const t = useTranslations("@vitnode/blog.list");
  const locale = useLocale();
  const labels = post.categoryId.flatMap(id => {
    const category = categories.get(id);

    return category ? [category] : [];
  });

  return (
    <article
      className="bg-card text-card-foreground flex h-full flex-col overflow-hidden rounded-xl border shadow-xs"
      // A fallback translation is in another language than the page around it.
      lang={post.locale === locale ? undefined : post.locale}
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
          className="bg-muted aspect-video w-full object-cover"
          decoding="async"
          fetchPriority={isPriority ? "high" : undefined}
          height={post.coverImage.height}
          loading={isPriority ? "eager" : "lazy"}
          // One column, then two from `md`, then three from `lg`, inside the
          // `max-w-6xl` page.
          sizes="(min-width: 64rem) 22rem, (min-width: 48rem) 50vw, 100vw"
          src={post.coverImage.url}
          width={post.coverImage.width}
        />
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
        {labels.length > 0 ? (
          <ul aria-label={t("categories")} className="flex flex-wrap gap-3">
            {labels.map(category => (
              <li key={category.id}>
                <BlogCategoryLabel category={category} />
              </li>
            ))}
          </ul>
        ) : null}

        <h2 className="text-foreground text-lg font-semibold tracking-tight text-balance">
          <HrefLink
            className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
            href={blogPostHref(post.friendlyUrl)}
          >
            {post.title}
          </HrefLink>
        </h2>

        {post.excerpt ? (
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed text-pretty">
            {post.excerpt}
          </p>
        ) : null}

        {post.publishedAt ? (
          <p className="text-muted-foreground mt-auto text-sm leading-relaxed">
            <span className="sr-only">{t("published")} </span>
            <time dateTime={new Date(post.publishedAt).toISOString()}>
              <DateFormat date={post.publishedAt} showFullDate />
            </time>
          </p>
        ) : null}
      </div>
    </article>
  );
};
