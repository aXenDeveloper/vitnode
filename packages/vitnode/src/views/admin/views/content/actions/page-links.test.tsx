import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";

vi.mock("server-only", () => ({}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  // Spreads everything, like the real `Link`. A mock that dropped the props
  // Base UI merges in - the ref above all - would render an anchor Base UI never
  // sees, and the accessibility check below would pass by not looking.
  Link: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { children: React.ReactNode }) => (
    <a data-testid="link" {...props}>
      {children}
    </a>
  ),
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => true,
}));

const { CreateContentAction } = await import("./create-action");
const { EditContentAction } = await import("./edit-action");

const spec: ContentFormSpec = {
  contentTypeId: "blog.post",
  defaultLocale: null,
  fields: [],
  pluginId: "@vitnode/blog",
  titleField: null,
};

/**
 * Page mode has to be a **link**, not a dialog that redirects.
 *
 * A dialog that mounted and then navigated would download the whole form - every
 * field component, the editor, the lot - to show it for one frame.
 */
describe("page-mode actions", () => {
  /**
   * Base UI complains rather than throws when a button renders as something that
   * is not a `<button>` and `nativeButton` was left `true` - which costs the
   * element its native button semantics in forms and assistive technology. A
   * warning nobody asserts on is a warning that ships, so every case below fails
   * on one.
   */
  let logged: unknown[][] = [];

  beforeEach(() => {
    logged = [];
    for (const level of ["error", "warn"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    expect(logged).toEqual([]);
  });

  it("creates through a link when the content type asked for a page", () => {
    render(
      <CreateContentAction
        href="/admin/content/blog/post/create"
        singular="Article"
        spec={spec}
      />,
    );

    expect(screen.getByTestId("link").getAttribute("href")).toBe(
      "/admin/content/blog/post/create",
    );
  });

  it("keeps the dialog when it did not", () => {
    render(<CreateContentAction singular="Article" spec={spec} />);

    expect(screen.queryByTestId("link")).toBeNull();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("edits through a link when the content type asked for a page", () => {
    render(
      <EditContentAction
        data={{ id: 42 }}
        href="/admin/content/blog/post/42/edit"
        permissionModule="posts"
        pluginId="@vitnode/blog"
        singular="Article"
        spec={spec}
      />,
    );

    expect(screen.getByTestId("link").getAttribute("href")).toBe(
      "/admin/content/blog/post/42/edit",
    );
  });

  it("keeps the edit dialog when it did not", () => {
    render(
      <EditContentAction
        data={{ id: 42 }}
        permissionModule="posts"
        pluginId="@vitnode/blog"
        singular="Article"
        spec={spec}
      />,
    );

    expect(screen.queryByTestId("link")).toBeNull();
  });
});
