import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const routeMessages = readFileSync(join(here, "route-messages.tsx"), "utf8");

/**
 * The bug this file exists to prevent coming back.
 *
 * `@vitnode/core` is external to a host's Vite SSR pass, so it is loaded by
 * Node, which resolves `use-intl` to its `default` (production) build; the app's
 * own source goes through Vite's module runner, which resolves the very same
 * package to its `development` build. Two files, two `createContext` calls, two
 * React contexts - and every `useTranslations` in the shared design system looks
 * for this package's one.
 *
 * Providing only one of the two is a 500 on the first render of any core
 * component, and - this is the part worth pinning - **only under `vite dev`**.
 * A production build merges both records into a single chunk, so the built
 * server, the SSR tests and CI were all green while `pnpm dev` was broken.
 * Nothing that runs in this suite can reproduce that, because Vitest resolves
 * both through Node and gets one record. So the guard is on the source.
 *
 * It lives beside the component rather than in the app because the component
 * does: `RouteMessages` is mounted by a root route for the shell's strings and
 * by a page for its own, and both of those used to be hand-written in
 * `apps/web`. One implementation, one guard.
 */
describe("RouteMessages provides every intl context core might read", () => {
  it("mounts use-intl's provider, as this package resolves it", () => {
    expect(routeMessages).toMatch(
      /import \{ IntlProvider(?: as \w+)? \} from "use-intl"/,
    );
    expect(routeMessages).toContain("<IntlProvider {...intlProps}>");
  });

  it("mounts this package's own record too, which every shared component reads", () => {
    // Deleting this line turns a host's `pnpm dev` into a 500 and leaves every
    // other check in this repository green.
    //
    // It is imported from `@/lib/i18n/provider` rather than from `next-intl`:
    // that module is loaded by whatever loaded this package, so it *is* the
    // record core's components read, rather than one that happens to resolve
    // the same way. It is also what keeps this file Next-free, which a TanStack
    // Start app requires.
    expect(routeMessages).toMatch(
      /import \{ IntlProvider as CoreIntlProvider \} from "@\/lib\/i18n\/provider"/,
    );
    expect(routeMessages).toContain("<CoreIntlProvider {...intlProps}>");
  });

  it("gives all three the identical locale, messages and time zone", () => {
    // Spread from one object rather than written three times: two providers
    // that disagree would render half the page in the wrong language. Twice as
    // a JSX spread and once as `createElement`'s props, which is the same
    // object reaching all three.
    expect(routeMessages).toMatch(/const intlProps = \{/);
    expect(routeMessages.match(/\.\.\.intlProps/g)).toHaveLength(3);
  });

  it("takes the locale from the router rather than from a second source", () => {
    // `useLocale` is subscribed to the router's location, which is what makes a
    // language switch re-render the provider - and what keeps the two providers
    // from ever being handed different answers.
    expect(routeMessages).toMatch(/const locale = useLocale\(\)/);
  });

  it("mounts the host's own record, which this package cannot import", () => {
    // The one record neither import above can reach. This file is on the
    // package's side of the `vite dev` module split, so both providers it
    // imports are the package's; a host component calling `useTranslations`
    // from its *own* `use-intl` reads a third context that only the host can
    // provide. It registers one through `configureIntl`, and this is where it
    // gets mounted.
    //
    // Dropping this turns a host's `pnpm dev` into "No intl context found" on
    // every route that translates anything itself, and leaves every other check
    // in this repository green - which is how it got here once already.
    expect(routeMessages).toContain("const { hostIntlProvider");
    expect(routeMessages).toContain(
      "createElement(hostIntlProvider, { ...intlProps, children: provided })",
    );
  });

  it("renders without one, so a host that registers none still works", () => {
    // Optional on purpose: a host whose every component takes its strings from
    // this package needs no third record, and must not be made to invent one.
    expect(routeMessages).toContain("if (!hostIntlProvider) return provided;");
  });

  it("reads nothing from next-intl", () => {
    // The whole reason this component exists outside Next.js.
    expect(routeMessages).not.toMatch(/from "next-intl/);
  });
});
