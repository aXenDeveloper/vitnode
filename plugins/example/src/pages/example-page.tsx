import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";

export const EXAMPLE_TABS = ["summary", "details"] as const;

export type ExampleTab = (typeof EXAMPLE_TABS)[number];

export interface ExampleSearch {
  tab: ExampleTab;
}

interface Note {
  lines: string[];
  title: string;
}

export const route = definePluginRoute<Note, ExampleSearch>({
  load: ({ params, search }) => ({
    lines:
      search.tab === "summary"
        ? [`"${params.slug}" in one line.`]
        : [`Everything about "${params.slug}".`, "Loaded for the details tab."],
    title: params.slug.replaceAll("-", " "),
  }),

  head: ({ loaderData, search }) => ({
    title: `${loaderData?.title ?? ""} - ${search.tab}`,
  }),
});

const NotePage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<Note, ExampleSearch>) => (
  <article className="container mx-auto flex max-w-3xl flex-col gap-4 p-4">
    <h1 className="text-3xl font-semibold tracking-tight text-balance capitalize">
      {loaderData.title}
    </h1>

    <nav aria-label="Note view" className="flex items-center gap-2">
      {EXAMPLE_TABS.map(tab => (
        <button
          aria-pressed={search.tab === tab}
          className="aria-pressed:bg-accent aria-pressed:text-accent-foreground rounded-md border px-3 py-2 capitalize"
          key={tab}
          onClick={() => {
            void navigate({ resetScroll: false, search: { tab } });
          }}
          type="button"
        >
          {tab}
        </button>
      ))}
    </nav>

    {loaderData.lines.map(line => (
      <p
        className="text-muted-foreground leading-relaxed text-pretty"
        key={line}
      >
        {line}
      </p>
    ))}
  </article>
);

export default NotePage;
