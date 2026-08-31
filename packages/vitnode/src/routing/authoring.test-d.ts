import { describe, expectTypeOf, it } from "vitest";

import type {
  PluginRouteContext,
  PluginRouteLayoutModule,
  PluginRouteLoadArgs,
  PluginRouteOptions,
  PluginRoutePageModule,
  PluginRoutePageProps,
} from "./module";

import { definePluginRoute } from "./authoring";

/**
 * The helper earns its place by inferring, so every assertion here is about
 * inference. Its runtime behaviour - returning its argument - is not worth a
 * test, and its shape is `PluginRouteOptions`, which `./module` owns.
 */
describe("definePluginRoute", () => {
  it("accepts every member of the contract, and only those", () => {
    // The helper re-declares `head` and `load` to control where each type is
    // inferred from, and takes the rest through `Omit`. This is what catches the
    // two ways that drifts: a member added to `PluginRouteOptions` that the
    // helper somehow drops, and a `head` or `load` renamed there, which would
    // leave the `Omit` removing nothing and the re-declaration adding a member
    // the contract no longer has.
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
      // Order-independent, unlike `load`: `parseSearch` annotates its own
      // return type, so TypeScript reads it before any context-sensitive member.
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

  it("promises the loader a locale without being told", () => {
    definePluginRoute({
      load: ({ context }) => {
        expectTypeOf(context.locale).toEqualTypeOf<string>();

        return null;
      },
    });
  });

  /**
   * The boundary, asserted from the plugin's side.
   *
   * `PluginRouteContext` used to be a *base* a plugin could widen by annotating
   * its own `load` parameter - which meant a plugin could compile against a
   * property no host had promised, and find it `undefined` at runtime. What the
   * host holds internally is `PluginRouteRuntimeContext`
   * (`@vitnode/core/tanstack/plugin-routes`), and only the locale is projected
   * out of it.
   */
  it("promises the loader the public context, and nothing more", () => {
    definePluginRoute({
      load: ({ context }) => {
        expectTypeOf(context).toEqualTypeOf<PluginRouteContext>();
        expectTypeOf(context).toEqualTypeOf<{ locale: string }>();

        return null;
      },
    });
  });

  it("refuses a `load` that asks for a context the host never promised", () => {
    interface WiderContext {
      locale: string;
      queryClient: { key: string };
    }

    definePluginRoute({
      // @ts-expect-error A plugin may not widen the context it is handed.
      load: ({ context }: { context: WiderContext }) => context.queryClient.key,
    });
  });

  it("has no context type argument to bind", () => {
    // `PluginRouteLoadArgs` is generic in the *search* only, so there is nowhere
    // left to name a wider context even deliberately.
    expectTypeOf<
      PluginRouteLoadArgs<{ section: string }>["context"]
    >().toEqualTypeOf<PluginRouteContext>();
  });

  it("rejects a `head` that reads a field the loader does not return", () => {
    definePluginRoute({
      load: () => ({ title: "x" }),
      // @ts-expect-error `loaderData` is `{ title: string } | undefined`.
      head: ({ loaderData }) => ({ title: loaderData?.missing }),
    });
  });

  it("names the cause when `head` is written above `load`", () => {
    // The whole point of the sentence-shaped default: TypeScript resolves an
    // object literal's context-sensitive members in order, so `loaderData` here
    // is not `{}` - it is a string that says what to do about it.
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

/**
 * The component half of the contract, which is what a plugin actually writes.
 *
 * `default` is generic in what the loader returned, so a page can *declare* the
 * props the runtime hands it. The property that is easiest to lose in doing that
 * is the one the simplest plugin depends on - that a component wanting none of
 * them is still a complete module - so it is asserted first.
 */
describe("a plugin route module's default export", () => {
  it("accepts a component that declares no props at all", () => {
    const Page = () => null;

    expectTypeOf(Page).toExtend<PluginRoutePageModule["default"]>();
  });

  it("accepts a page that declares the props its loader feeds", () => {
    interface Topic {
      title: string;
    }

    const Page = ({
      loaderData,
      params,
    }: PluginRoutePageProps<Topic, unknown>) =>
      `${loaderData.title}${params.topic}`;

    // `PluginRoutePageProps` is given its `TSearch` explicitly above, because
    // the two types default it differently: the props to `Record<string, never>`
    // so an author writing a page with no `parseSearch` gets an empty object
    // rather than `unknown`, and the module interface to `unknown` for a
    // consumer that has not looked at the route yet. Props are contravariant, so
    // a page cannot be checked against a module type without the two agreeing.
    expectTypeOf(Page).toExtend<PluginRoutePageModule<Topic>["default"]>();
  });

  it("accepts a layout that declares only its children", () => {
    // Wrapped in an array rather than returned bare: React 19's `ReactNode`
    // includes a promise, and a component that might return one has to be
    // `async`.
    const Layout = ({ children }: { children: React.ReactNode }) => [children];

    expectTypeOf(Layout).toExtend<PluginRouteLayoutModule["default"]>();
  });

  it("hands a page its loader's data, not an optional of it", () => {
    // The asymmetry with `head`, which is real: `head` runs on passes where the
    // loader has not resolved, and a match does not render until it has.
    expectTypeOf<
      PluginRoutePageProps<{ title: string }>["loaderData"]
    >().toEqualTypeOf<{ title: string }>();
  });
});
