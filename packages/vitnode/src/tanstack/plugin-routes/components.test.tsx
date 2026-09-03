import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RouteBreadcrumbProps } from "../breadcrumb/model";

import { pluginRouteBreadcrumb } from "./components";
import { pluginRouteModuleRef } from "./module-ref";

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
