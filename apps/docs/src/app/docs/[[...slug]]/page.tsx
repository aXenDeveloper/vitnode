import { source } from '@/lib/source';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound, redirect } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  if (!params.slug) {
    redirect('/docs/dev');
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();
  const path = `docs/${page.file.path}`;
  const MDX = page.data.body;

  return (
    <DocsPage
      editOnGithub={{
        repo: 'vitnode',
        owner: 'vitnode',
        sha: 'canary',
        path,
      }}
      tableOfContent={{
        style: 'clerk',
        single: false,
      }}
      toc={page.data.toc}
      full={page.data.full}
    >
      <div className="space-y-2">
        <h1 className="text-foreground text-3xl font-bold sm:text-4xl">
          {page.data.title}
        </h1>
        <p className="text-muted-foreground text-lg">{page.data.description}</p>
      </div>

      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
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
