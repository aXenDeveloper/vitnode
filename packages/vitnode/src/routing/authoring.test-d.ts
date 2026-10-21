import { describe, expectTypeOf, it } from "vitest";

import type {
  PluginRouteContext,
  PluginRouteLayoutModule,
  PluginRouteOptions,
  PluginRoutePageModule,
  PluginRoutePageProps,
} from "./module";

import { definePluginRoute } from "./authoring";
import { index, layout, lazy, page } from "./tree";

describe("definePluginRoute", () => {
  it("accepts every member of the contract, and only those", () => {
    type Authored = Parameters<typeof definePluginRoute>[0];

    expectTypeOf<keyof Authored>().toEqualTypeOf<keyof PluginRouteOptions>();
  });

  it("flows the loader's return type into `head`", () => {
    definePluginRoute({
      load: ({ params }) => ({ title: `Topic ${params.topic}` }),
      head: ({ loaderData }) => {
        expectTypeOf(loaderData).toEqualTypeOf<undefined | { title: string }>();

        return { title: loaderData?.title };
      },
    });
  });

  it("flows `parseSearch`'s return type into `load` and `head`", () => {
    definePluginRoute({
      parseSearch: (): { section: string } => ({ section: "" }),
      load: ({ search }) => {
        expectTypeOf(search).toEqualTypeOf<{ section: string }>();

        return null;
      },
      head: ({ search }) => {
        expectTypeOf(search).toEqualTypeOf<{ section: string }>();

        return {};
      },
    });
  });

  it("hands the loader the public context and nothing more", () => {
    definePluginRoute({
      load: ({ context }) => {
        expectTypeOf(context).toEqualTypeOf<PluginRouteContext>();
        expectTypeOf(context).toEqualTypeOf<{ locale: string }>();

        return null;
      },
    });
    definePluginRoute({
      // @ts-expect-error A plugin may not widen the context it is handed.
      load: ({
        context,
      }: {
        context: { locale: string; queryClient: string };
      }) => context.queryClient,
    });
  });

  it("rejects a `head` that reads a field the loader does not return", () => {
    definePluginRoute({
      load: () => ({ title: "x" }),
      // @ts-expect-error `loaderData` is `{ title: string } | undefined`.
      head: ({ loaderData }) => ({ title: loaderData?.missing }),
    });
  });

  it("names the cause when `head` is written above `load`", () => {
    definePluginRoute({
      // @ts-expect-error definePluginRoute: `loaderData` is typed only when `load` is declared ABOVE `head`
      head: ({ loaderData }) => ({ title: loaderData?.title }),
      // @ts-expect-error definePluginRoute: `loaderData` is typed only when `load` is declared ABOVE `head`
      load: ({ params }) => ({ title: `Topic ${params.topic}` }),
    });
  });

  it("rejects a member the contract does not declare", () => {
    definePluginRoute({
      // @ts-expect-error `beforeLoad` is the runtime's, not a plugin's.
      beforeLoad: () => null,
    });
  });
});

describe("a plugin route module's default export", () => {
  it("accepts a page without props, a page with loader props and a layout", () => {
    interface Topic {
      title: string;
    }

    const Bare = () => null;
    const Page = ({
      loaderData,
      params,
    }: PluginRoutePageProps<Topic, unknown>) =>
      `${loaderData.title}${params.topic}`;
    const Layout = ({ children }: { children: React.ReactNode }) => [children];

    expectTypeOf(Bare).toExtend<PluginRoutePageModule["default"]>();
    expectTypeOf(Page).toExtend<PluginRoutePageModule<Topic>["default"]>();
    expectTypeOf(Layout).toExtend<PluginRouteLayoutModule["default"]>();
  });

  it("hands a page its loader's data, not an optional of it", () => {
    expectTypeOf<
      PluginRoutePageProps<{ title: string }>["loaderData"]
    >().toEqualTypeOf<{ title: string }>();
  });
});

describe("a route declaration's `preload`", () => {
  const component = lazy(
    async () => await Promise.resolve({ default: () => null }),
  );

  it("is a boolean on every shape, never a router mode", () => {
    layout("/catalog", {
      children: [index({ component, preload: true })],
      component,
      preload: false,
    });
    // @ts-expect-error `preload` is `true` or `false`; *when* to preload is the router's.
    page("/catalog", { component, preload: "intent" });
  });
});
