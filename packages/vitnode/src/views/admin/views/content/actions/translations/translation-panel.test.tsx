import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";

vi.mock("server-only", () => ({}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => true,
}));

vi.mock("../translation-api.server", () => ({
  createContentTranslationAction: vi.fn(),
  deleteContentTranslationAction: vi.fn(),
  editContentTranslationAction: vi.fn(),
  getContentTranslationAction: async () => {
    await Promise.resolve();

    return { row: null };
  },
  publishContentTranslationAction: vi.fn(),
  unpublishContentTranslationAction: vi.fn(),
}));

vi.mock("../mutation-api.server", () => ({
  loadContentOptionsAction: async () => await Promise.resolve([]),
}));

const { TranslationPanel } = await import("./translation-panel");

const spec: ContentFormSpec = {
  contentTypeId: "test.localized",
  pluginId: "@vitnode/test",
  titleField: "title",
  fields: [
    {
      kind: "text",
      label: "Title",
      name: "title",
      nullable: false,
      required: true,
    },
    {
      kind: "textarea",
      label: "Body",
      name: "body",
      nullable: false,
      required: true,
    },
  ],
};

const renderPanel = (
  props: Partial<React.ComponentProps<typeof TranslationPanel>> = {},
) =>
  render(
    <TranslationPanel
      contentTypeId="test.localized"
      editorial={false}
      isDefaultLocale
      itemId={7}
      languageName="English"
      locale="en"
      onMutated={() => undefined}
      permissionModule="pages"
      pluginId="@vitnode/test"
      publication={false}
      spec={spec}
      {...props}
    />,
  );

/**
 * A locale tab has to render **inputs**.
 *
 * It once did not: the panel handed `AutoForm` a list of bare field ids, and
 * `AutoForm` renders nothing for a field with no component - so every localized
 * content type had a form with a submit button and no way to type into it.
 */
describe("TranslationPanel", () => {
  it("renders an input for every localized field", async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toBeTruthy();
    });
    expect(screen.getByLabelText("Body")).toBeTruthy();
  });

  it("uses a registered field override, exactly as the shared form does", async () => {
    renderPanel({
      fieldOverrides: {
        body: () => <div data-testid="custom-editor" />,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("custom-editor")).toBeTruthy();
    });
    // The override replaced the generated input, and nothing else moved.
    expect(screen.getByLabelText("Title")).toBeTruthy();
  });

  it("hands a registered layout the localized surface", async () => {
    renderPanel({
      layout: ({ surface }) => <div data-testid="layout">{surface}</div>,
    });

    await waitFor(() => {
      expect(screen.getByTestId("layout").textContent).toBe("translation");
    });
  });
});
