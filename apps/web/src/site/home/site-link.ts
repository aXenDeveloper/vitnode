/**
 * How a link on this site becomes a navigation.
 *
 * A prop rather than an import, in every section of the front page, so that
 * exactly one module names `MigrationLink` - the route file, which is where this
 * application keeps every such decision and what `migration-destination.test.ts`
 * holds it to. The sections below stay framework-neutral and take whatever they
 * are handed.
 *
 * That is not ceremony. `/docs/dev` is the destination of the page's primary
 * call to action and it is served by the Next.js application until Stage 16.
 * `MigrationLink` asks the route tree, per href, which application can render
 * the destination - so the button is a document navigation today and becomes a
 * client-side one the moment `/docs` appears in this app's route tree, with no
 * edit here and with no `href.startsWith('/docs')` anywhere on this page. When
 * the migration is over the same sections take the router's own `Link` and
 * nothing else changes.
 *
 * Written structurally rather than as `ComponentType<MigrationLinkProps>` for
 * the same reason: `MigrationLink` satisfies this, and so does a plain `<a>`,
 * and so will whatever replaces it - without `#/site` naming the migration layer
 * at all. It is every prop of an anchor with `href` made required, because a
 * link component that only accepted `children` and `className` would silently
 * drop the `ref` a Base UI `render` clones onto it.
 */
export type SiteLinkComponent = React.ComponentType<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>
