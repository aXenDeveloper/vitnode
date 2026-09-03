import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RouteBreadcrumbProps } from "../breadcrumb/model";

import { pluginRouteBreadcrumb } from "./components";
import { pluginRouteModuleRef } from "./module-ref";

/**
 * What a plugin route contributes to the shell's trail, once its module has
 * arrived - and what it contributes before that, which is nothing.
 *
 * The crumb is rendered by the shell, *above* the route's own component, so it
 * cannot suspend on the module it reads: a suspend there blanks the header
 * rather than the page. What it does instead is render nothing until the module
 * resolves and then re-render, which is what `useSyncExternalStore` over the
 * memoised import buys.
 *
 * No namespaces are declared here on purpose: a route that declares none mounts
 * no message provider at all, so this needs no intl record and asserts only the
 * part that belongs to this file. Which namespaces a route's provider gets is
 * `./specs.test.ts`.
 */
const moduleWith = (route: Record<string, unknown>) => {
  let resolve = (): void => undefined;
  const arrived = new Promise<void>(settle => {
    resolve = () => {
      settle();
    };
  });

  const ref = pluginRouteModuleRef(async () => {
    await arrived;

    return { default: () => null, route };
  }, "plugin:page#/page");

  return { load: ref, ready: resolve, ref };
};

const props: RouteBreadcrumbProps = {
  loaderData: { data: { name: "MacBook Pro" }, search: { page: 2 } },
  params: { productId: "42" },
  pathname: "/catalog/products/42",
  search: {},
};

describe("pluginRouteBreadcrumb", () => {
  it("renders nothing until the route's module has arrived", async () => {
    const { load, ready, ref } = moduleWith({
      breadcrumb: () => "MacBook Pro",
    });
    const Breadcrumb = pluginRouteBreadcrumb(ref, []);

    const { container } = render(<Breadcrumb {...props} />);

    expect(container.innerHTML).toBe("");

    ready();
    await load();
    await screen.findByText("MacBook Pro");
  });

  it("hands the plugin's crumb this route's own loader data", async () => {
    const seen: unknown[] = [];
    const { load, ready, ref } = moduleWith({
      breadcrumb: (given: { loaderData: { name: string } }) => {
        seen.push(given);

        return given.loaderData.name;
      },
    });
    const Breadcrumb = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();
    render(<Breadcrumb {...props} />);

    await screen.findByText("MacBook Pro");
    // Unwrapped from the runtime's envelope: a plugin sees its own `load`
    // result and its own validated search, never the envelope itself.
    expect(seen).toEqual([
      {
        loaderData: { name: "MacBook Pro" },
        params: { productId: "42" },
        search: { page: 2 },
      },
    ]);
  });

  it("renders nothing for a module that declares `breadcrumb: false`", async () => {
    const { load, ready, ref } = moduleWith({ breadcrumb: false });
    const Breadcrumb = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    const { container } = render(<Breadcrumb {...props} />);

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a module that declares no crumb at all", async () => {
    const { load, ready, ref } = moduleWith({});
    const Breadcrumb = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    const { container } = render(<Breadcrumb {...props} />);

    expect(container.innerHTML).toBe("");
  });
});
