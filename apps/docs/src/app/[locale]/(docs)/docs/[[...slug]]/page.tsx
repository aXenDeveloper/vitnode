import { redirect } from '@vitnode/core/lib/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';

import { Preview } from '@/components/fumadocs/preview';
import { source } from '@/lib/source';

import { ViewOptions } from './page.client';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  if (!params.slug) {
    await redirect('/docs/dev');
  }
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <DocsPage
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
        single: false,
      }}
      toc={page.data.toc}
    >
      <div className="space-y-2">
        <h1 className="text-foreground text-3xl font-bold sm:text-4xl">
          {page.data.title}
        </h1>
        <p className="text-muted-foreground text-lg">{page.data.description}</p>

        <div className="flex flex-row items-center gap-2 border-b pt-2 pb-6">
          <ViewOptions
            githubUrl={`https://github.com/aXenDeveloper/vitnode/blob/canary/apps/docs/content/docs/${page.path}`}
            markdownUrl={page.url}
          />
        </div>
      </div>

      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, Preview }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
