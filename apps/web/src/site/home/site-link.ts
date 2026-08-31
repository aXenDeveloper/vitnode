/**
 * How a link on this site becomes a navigation.
 *
 * A prop rather than an import, in every section of the front page, so that
 * exactly one module decides it - the route file. The sections below stay
 * framework-neutral and take whatever they are handed.
 *
 * That is not ceremony, and the page has the receipts. `/docs/dev` is the
 * destination of the primary call to action, and how a click on it travelled has
 * now changed three times - a document load into a second application, then a
 * per-href decision between two of them, and now an ordinary client-side
 * navigation. No section was edited for any of it, and there is no
 * `href.startsWith('/docs')` anywhere on this page.
 *
 * Written structurally rather than against a named component for the same
 * reason: `RouterLink` satisfies this, and so does a plain `<a>`, and so will
 * whatever comes next - without `#/site` naming a router at all. It is every
 * prop of an anchor with `href` made required, because a link component that
 * only accepted `children` and `className` would silently drop the `ref` a Base
 * UI `render` clones onto it.
 */
export type SiteLinkComponent = React.ComponentType<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>
