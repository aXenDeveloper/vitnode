import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";

vi.mock("server-only", () => ({}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a data-testid="link" href={href}>
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
