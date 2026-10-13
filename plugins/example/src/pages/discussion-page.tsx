import { RichTextContent } from "@vitnode/core/components/rich-text";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { zodRichTextDocument } from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { PencilIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import type { DiscussionSearch } from "./discussion-search";

import { ContentArticle } from "./content-article";
import { discussionEditHref } from "./discussion-search";

const zodDiscussion = z.object({
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadDiscussion = async (slug: string) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/discussions",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  return contentPageItem(
    detail.status === 200 ? zodDiscussion.parse(await detail.json()) : null,
  );
};

type DiscussionPageData = Awaited<ReturnType<typeof loadDiscussion>>;

export const route = definePluginRoute<DiscussionPageData, DiscussionSearch>({
  load: async ({ params }) => await loadDiscussion(params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.title }),

  breadcrumb: ({ loaderData }) => <span>{loaderData.title}</span>,
});

const DiscussionPage = ({
  loaderData: item,
  navigate,
  search,
}: PluginRoutePageProps<DiscussionPageData, DiscussionSearch>) => {
  const t = useTranslations("@vitnode/example.discussions.detail");
  const created = search.created === true;
  const announcedRef = useRef(false);

  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the event happened on the previous page; landing here is all that is left of it
    if (!created || announcedRef.current) return;
    announcedRef.current = true;

    toast.success(t("created.title"), { description: t("created.desc") });
    void navigate({ resetScroll: false, search: {} });
  }, [created, navigate, t]);

  return (
    <ContentArticle publishedAt={item.publishedAt} title={item.title}>
      <nav aria-label={t("actions")} className="flex flex-wrap gap-2">
        <a
          className={buttonVariants({ variant: "outline" })}
          href={discussionEditHref(item.id)}
        >
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </a>
        <a
          className={buttonVariants({ variant: "ghost" })}
          href="/discussions/new"
        >
          {t("new")}
        </a>
      </nav>

      <RichTextContent
        className="text-foreground leading-relaxed text-pretty"
        content={item.body}
      />
    </ContentArticle>
  );
};

export default DiscussionPage;
