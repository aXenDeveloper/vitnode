import type {
  PluginRouteHead,
  PluginRouteHeadArgs,
  PluginRouteLoadArgs,
  PluginRouteOptions,
} from "./module";

/**
 * The one helper this layer offers a plugin author, and the reason it exists.
 *
 *     ./types      what a plugin declares in its manifest
 *     ./module     what a plugin's route module exports
 *     ./authoring  the single place those two are hard to write by hand
 *
 * Everything else a plugin writes is plain data with a type annotation on it -
 * `const routes: PluginRouteDefinition[] = [...]` checks every field, catches a
 * misspelled key and needs no function wrapped around it. A helper there would
 * be an identity function pretending to be an API, so there is not one.
 *
 * `route` is the exception, and a genuine one rather than a matter of taste.
 * {@link PluginRouteOptions} is generic in what the loader returns and in what
 * `parseSearch` returns, and those two types are what `head`, `load` and the
 * component all read. A `satisfies` clause has to *name* them, because
 * `satisfies` checks a value against a type and never infers that type's
 * arguments from the value:
 *
 *     export const route = {
 *       load: ({ params }) => ({ title: `Topic ${params.topic}` }),
 *       head: ({ loaderData }) => ({ title: loaderData?.title }),
 *                                              ~~~~~
 *       // Property 'title' does not exist on type '{}'.
 *     } satisfies PluginRoutePageModule["route"]
 *
 * The loader's return type collapses to nothing, so a page's metadata cannot
 * read the page's own data - and the way out is for the author to write an
 * interface, repeat it in two type arguments, and keep the three in step by
 * hand. A generic function infers all of it from code that is already there:
 *
 *     export const route = definePluginRoute({
 *       load: ({ params }) => ({ title: `Topic ${params.topic}` }),
 *       head: ({ loaderData }) => ({ title: loaderData?.title }),  // string
 *     })
 *
 * That is the whole of what it does. It returns its argument unchanged, adds no
 * shape a hand-written `route` could not have, and is erased to the object
 * literal at runtime. `readPluginRouteModule` still checks what actually
 * arrives, because a plugin is compiled JavaScript by the time a host loads it
 * and nothing here can promise otherwise.
 *
 * ## One rule: `load` goes above `head`
 *
 * TypeScript resolves an object literal's context-sensitive members in the order
 * they are written, so `head`'s `loaderData` is only typed once `load` has been
 * read. This is TanStack Router's own constraint, and VitNode's own routes carry
 * a comment about it - what is different here is that getting it wrong says so:
 * see {@link UnknownLoaderData}.
 */

/**
 * What `TData` is when nothing has told the helper what the loader returns.
 *
 * A sentence rather than `unknown`, because this is a type a plugin author reads
 * in an error message and never writes. Both ways of arriving here are mistakes
 * with the same fix, and both errors quote this string:
 *
 *     Property 'title' does not exist on type '"definePluginRoute: `loaderData`
 *     is typed only when `load` is declared ABOVE `head`"'.
 *
 * The alternative is TypeScript's own report - `Property 'title' does not exist
 * on type '{}'` - which is the failure VitNode's own route files carry a
 * three-line comment to explain, ending "Neither error names the cause". This
 * one names it.
 */
type UnknownLoaderData =
  "definePluginRoute: `loaderData` is typed only when `load` is declared ABOVE `head`";

/**
 * {@link PluginRouteOptions}, with each type argument given exactly one place to
 * be inferred from.
 *
 * Not a convenience. `head` and `load` both *mention* `TData` and `TSearch`, so
 * both are inference sites for them, and TypeScript resolves context-sensitive
 * arguments in the order they are written. That made the helper's inference
 * depend on **key order**: `load` before `head` inferred `{ title: string }`,
 * and `head` before `load` - which is the order this repository's lint rule
 * sorts object keys into - fixed `TData` at its default before the loader was
 * ever looked at. A helper whose types depend on how its argument was
 * alphabetised is worse than no helper.
 *
 * `NoInfer` states which member is the source of truth for each type, so the
 * order stops mattering:
 *
 * - `TData` from what `load` returns. `head` only reads it.
 * - `TSearch` from what `parseSearch` returns. `head` and `load` only read it.
 *
 * There is deliberately no `TContext`. What a plugin's `load` is handed is
 * {@link PluginRouteContext} and only that - see `./module` for why a contract
 * the consumer can widen is not a contract.
 *
 * Derived with `Omit` rather than re-declared member by member, so a member
 * added to the contract arrives here without an edit. `authoring.test-d.ts`
 * asserts the two have the same keys, which is what catches the other direction:
 * a `head` or `load` that got renamed, leaving an `Omit` that quietly removes
 * nothing.
 */
type AuthoredPluginRouteOptions<TData, TSearch> = Omit<
  PluginRouteOptions<TData, TSearch>,
  "head" | "load"
> & {
  head?: (
    args: PluginRouteHeadArgs<NoInfer<TData>, NoInfer<TSearch>>,
  ) => PluginRouteHead;
  load?: (
    args: PluginRouteLoadArgs<NoInfer<TSearch>>,
  ) => Promise<TData> | TData;
};

/**
 * A plugin route module's `route` export, with its own types inferred.
 *
 * Both kinds of module use it: a layout's `route` is the same shape as a page's,
 * and what differs between them is the component's props, which is the module's
 * default export and not this.
 *
 *     import { definePluginRoute } from "@vitnode/core/routing";
 *
 *     export const route = definePluginRoute({
 *       load: ({ context, params }) => fetchTopic(context.locale, params.topic),
 *       head: ({ loaderData }) => ({ title: loaderData?.title }),
 *       breadcrumb: () => <span>{useTranslations("my-plugin")("title")}</span>,
 *     });
 *
 * `context` is {@link PluginRouteContext} - the locale - and there is no way to
 * ask for a wider one. Annotating `load`'s parameter with a bigger shape is a
 * type error rather than a promise nobody made.
 */
export const definePluginRoute = <
  TData = UnknownLoaderData,
  TSearch = Record<string, never>,
>(
  options: AuthoredPluginRouteOptions<TData, TSearch>,
): PluginRouteOptions<TData, TSearch> => options;
