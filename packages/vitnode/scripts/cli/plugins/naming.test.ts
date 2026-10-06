// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  defaultPackageName,
  pluginApiVariableName,
  pluginVariableName,
  shortNameOf,
  validatePackageName,
  validatePluginName,
} from "./naming";

describe("validatePluginName", () => {
  it.each(["blog", "event-calendar", "forum2"])("accepts %s", name => {
    expect(validatePluginName(name)).toBeNull();
  });

  it.each([
    ["", "required"],
    ["Blog", "not a valid plugin name"],
    ["my_blog", "not a valid plugin name"],
    ["2fa", "not a valid plugin name"],
    ["blog-", "not a valid plugin name"],
    ["my--blog", "not a valid plugin name"],
    ["@acme/blog", "not a valid plugin name"],
    ["admin", "reserved"],
    ["core", "reserved"],
    ["login", "reserved"],
    ["x".repeat(51), "under 50"],
  ])("refuses %j (%s)", (name, reason) => {
    expect(validatePluginName(name)).toContain(reason);
  });
});

describe("validatePackageName", () => {
  it.each(["@acme/blog", "vitnode-plugin-blog", "@vitnode/blog"])(
    "accepts %s",
    name => {
      expect(validatePackageName(name)).toBeNull();
    },
  );

  it.each([
    ["@vitnode/core", "core package"],
    ["Acme-Blog", "lowercase"],
    ["acme blog", "not a valid npm package name"],
    [".hidden", "not a valid npm package name"],
    ["fs", "built-in"],
    ["@acme/", "not a valid npm package name"],
  ])("refuses %j (%s)", (name, reason) => {
    expect(validatePackageName(name)).toContain(reason);
  });
});

describe("package naming", () => {
  it("joins the workspace's plugin scope when its plugins share one", () => {
    expect(
      defaultPackageName("blog", ["@vitnode/example", "@vitnode/forum"]),
    ).toBe("@vitnode/blog");
  });

  it("falls back to an unscoped vitnode-plugin- name", () => {
    expect(defaultPackageName("blog", [])).toBe("vitnode-plugin-blog");
    expect(defaultPackageName("blog", ["@a/x", "@b/y"])).toBe(
      "vitnode-plugin-blog",
    );
  });

  it("derives the short name from a package name", () => {
    expect(shortNameOf("@acme/blog")).toBe("blog");
    expect(shortNameOf("blog")).toBe("blog");
  });

  it("derives identifiers for the generated factories", () => {
    expect(pluginVariableName("event-calendar")).toBe("eventCalendarPlugin");
    expect(pluginVariableName("blog-plugin")).toBe("blogPlugin");
    expect(pluginApiVariableName("blog")).toBe("blogApiPlugin");
  });
});
