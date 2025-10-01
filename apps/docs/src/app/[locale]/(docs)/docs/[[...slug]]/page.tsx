import type { Metadata } from "next";

import { redirect } from "@vitnode/core/lib/navigation";
import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";
import { Step, Steps } from "fumadocs-ui/components/steps";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import { Preview } from "@/components/fumadocs/preview";
import { source } from "@/lib/source";

import { ViewOptions } from "./page.client";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  if (!params.slug) {
    await redirect("/docs/dev");
  }
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <DocsPage
      full={page.data.full}
      tableOfContent={{
        style: "clerk",
        single: false,
      }}
      toc={page.data.toc}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-foreground text-3xl font-bold sm:text-4xl">
            {page.data.title}
          </h1>

          <ViewOptions
            githubUrl={`https://github.com/aXenDeveloper/vitnode/blob/canary/apps/docs/content/docs/${page.path}`}
            markdownUrl={page.url}
          />
        </div>
        <p className="text-muted-foreground text-lg">{page.data.description}</p>
      </div>

      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, Preview, Steps, Step }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const breadcrumb = getBreadcrumbItems(page.url, source.pageTree, {});
  const lastItemsBreadcrumb = breadcrumb
    .slice(0, -1)
    .reverse()
    .map(item => item.name as string);

  const title = `${page.data.title}${lastItemsBreadcrumb.length > 0 ? ` - ${lastItemsBreadcrumb.join(" - ")}` : ""}`;

  return {
    title,
    description: page.data.description,
    openGraph: {
      title,
      description: page.data.description,
      type: "article",
    },
  };
}
