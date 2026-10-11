import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  RouteBreadcrumbDeferred,
  RouteBreadcrumbProps,
} from "../breadcrumb/model";

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

const crumbOf = (deferred: RouteBreadcrumbDeferred) => {
  const declared = deferred.resolve();

  if (typeof declared !== "function") {
    throw new Error(`expected a crumb component, got ${typeof declared}`);
  }

  return declared;
};

describe("pluginRouteBreadcrumb", () => {
  it("resolves to nothing until the route's module has arrived", async () => {
    const { load, ready, ref } = moduleWith({
      breadcrumb: () => "MacBook Pro",
    });
    const deferred = pluginRouteBreadcrumb(ref, []);

    expect(deferred.resolve()).toBeUndefined();

    ready();
    await load();

    const Crumb = crumbOf(deferred);

    render(<Crumb {...props} />);
    await screen.findByText("MacBook Pro");
  });

  it("tells the trail when the module arrives", async () => {
    const { load, ready, ref } = moduleWith({
      breadcrumb: () => "MacBook Pro",
    });
    const listener = vi.fn();

    pluginRouteBreadcrumb(ref, []).subscribe(listener);

    ready();
    await load();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("hands the plugin's crumb this route's own loader data", async () => {
    const seen: unknown[] = [];
    const { load, ready, ref } = moduleWith({
      breadcrumb: (given: { loaderData: { name: string } }) => {
        seen.push(given);

        return given.loaderData.name;
      },
    });
    const deferred = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    const Crumb = crumbOf(deferred);

    render(<Crumb {...props} />);

    await screen.findByText("MacBook Pro");
    expect(seen).toEqual([
      {
        loaderData: { name: "MacBook Pro" },
        params: { productId: "42" },
        search: { page: 2 },
      },
    ]);
  });

  it("resolves to one component however often it is asked", async () => {
    const { load, ready, ref } = moduleWith({
      breadcrumb: () => "MacBook Pro",
    });
    const deferred = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    expect(deferred.resolve()).toBe(deferred.resolve());
  });

  it("resolves to `false` for a module that declares `breadcrumb: false`", async () => {
    const { load, ready, ref } = moduleWith({ breadcrumb: false });
    const deferred = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    expect(deferred.resolve()).toBe(false);
  });

  it("resolves to nothing for a module that declares no crumb at all", async () => {
    const { load, ready, ref } = moduleWith({});
    const deferred = pluginRouteBreadcrumb(ref, []);

    ready();
    await load();

    expect(deferred.resolve()).toBeUndefined();
  });
});
