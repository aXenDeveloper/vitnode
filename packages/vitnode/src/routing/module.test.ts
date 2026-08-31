// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readPluginRouteModule } from "./module";

const Page = () => null;

describe("readPluginRouteModule", () => {
  it("accepts the smallest module a plugin can ship", () => {
    // The prototype's contract, unchanged: a default export and nothing else.
    // Every plugin page that exists today still passes.
    const checked = readPluginRouteModule({ default: Page }, "p:page");

    expect(checked.component).toBe(Page);
    expect(checked.route).toEqual({});
  });

  it("keeps every declared option, and only the declared ones", () => {
    const head = () => ({ title: "Post" });
    const load = () => ({ title: "Post" });
    const parseSearch = () => ({});
    const breadcrumb = () => null;

    const checked = readPluginRouteModule(
      {
        default: Page,
        // Not part of the contract, and not an error: a module is free to
        // export helpers, constants and its own types beside the two names.
        POST_SIZE: 20,
        route: { breadcrumb, head, load, parseSearch },
      },
      "p:page",
    );

    expect(checked.route).toEqual({ breadcrumb, head, load, parseSearch });
  });

  it("ignores an option that is explicitly undefined", () => {
    const checked = readPluginRouteModule(
      { default: Page, route: { head: undefined } },
      "p:page",
    );

    expect("head" in checked.route).toBe(false);
  });

  it.each([undefined, null, "a module", 7])(
    "refuses %s as a module",
    module => {
      expect(() => readPluginRouteModule(module, "p:page")).toThrow(
        /"p:page" is not a module object/,
      );
    },
  );

  /**
   * Without this the failure is React's "type is invalid" from inside a lazy
   * component, three frames from the plugin that caused it and naming nothing.
   */
  it("refuses a module with no default export, naming the route", () => {
    expect(() =>
      readPluginRouteModule({ route: {} }, "@vitnode/blog:post"),
    ).toThrow(/"@vitnode\/blog:post" does not export a component/);
  });

  /**
   * A route id is what the *manifest* calls the page. The specifier is the file,
   * and this is a failure fixed by opening it - so when the caller knows the
   * import, the message says both.
   */
  it("names the module's specifier when it is given one", () => {
    expect(() =>
      readPluginRouteModule(
        { route: {} },
        "@vitnode/blog:post",
        "@vitnode/blog/routes/post-page",
      ),
    ).toThrow(
      /"@vitnode\/blog:post" \("@vitnode\/blog\/routes\/post-page"\) does not export a component/,
    );
  });

  it("still names the route alone for a caller with no import to name", () => {
    expect(() => readPluginRouteModule({ route: {} }, "p:page")).toThrow(
      /plugin route "p:page" does not export a component/,
    );
  });

  it("refuses a `route` that is not an object", () => {
    expect(() =>
      readPluginRouteModule({ default: Page, route: "yes" }, "p:page"),
    ).toThrow(/exports a `route` that is not an object/);
  });

  it.each(["breadcrumb", "head", "load", "parseSearch"])(
    "refuses a non-function `route.%s`",
    key => {
      expect(() =>
        readPluginRouteModule(
          { default: Page, route: { [key]: "nope" } },
          "p:page",
        ),
      ).toThrow(
        new RegExp(`declares \`route\\.${key}\`, which must be a function`),
      );
    },
  );

  /**
   * A breadcrumb is a *component*, not an element - the label is translated and
   * on a dynamic route comes from the loader, so it has to be able to use hooks.
   * A plugin that exported `<Crumb />` by mistake is caught here rather than by
   * React.
   */
  it("refuses a breadcrumb element", () => {
    expect(() =>
      readPluginRouteModule(
        { default: Page, route: { breadcrumb: { props: {}, type: "span" } } },
        "p:page",
      ),
    ).toThrow(/`route\.breadcrumb`, which must be a function \(got object\)/);
  });

  it("does not carry unknown members of `route` through", () => {
    const checked = readPluginRouteModule(
      // A plugin reaching for a TanStack route option gets nothing, silently -
      // the contract is the five names above, and a sixth is not a passthrough.
      { default: Page, route: { beforeLoad: () => null } },
      "p:page",
    );

    expect(checked.route).toEqual({});
  });
});
