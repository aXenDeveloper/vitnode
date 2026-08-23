import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { VITNODE_PATHNAME_HEADER } from "../request-pathname";
import { createVitNodeProxy } from "./proxy";

let stamped: null | string = null;

vi.mock("next-intl/middleware", () => ({
  default: () => (request: NextRequest) => {
    stamped = request.headers.get(VITNODE_PATHNAME_HEADER);

    return NextResponse.next();
  },
}));

const proxy = createVitNodeProxy({
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
});

/** The path next-intl - and with it the app - is handed for `url`. */
const stampedPathname = (url: string) => {
  proxy(new NextRequest(url));

  return stamped;
};

describe("createVitNodeProxy", () => {
  it("stamps the requested path, query string included", () => {
    expect(
      stampedPathname("https://vitnode.test/admin/core/users?page=2"),
    ).toBe("/admin/core/users?page=2");
  });

  it("strips the locale prefix, so the path can be localized again later", () => {
    expect(stampedPathname("https://vitnode.test/pl/admin/core")).toBe(
      "/admin/core",
    );
  });
});
