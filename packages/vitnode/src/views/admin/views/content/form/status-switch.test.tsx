import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import { type ContentFormContextValue, ContentFormProvider } from "./context";
import { ContentFormStatusSwitch } from "./status-switch";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" timeZone="UTC">
    {children}
  </IntlProvider>
);

const renderSwitch = (
  publication: Partial<ContentFormContextValue["publication"]> = {},
) => {
  const transition = vi.fn(async () => Promise.resolve(true));

  render(
    <ContentFormProvider
      value={{
        fieldNames: [],
        fields: {},
        localizedFieldNames: [],
        mode: "edit",
        publication: {
          canPublish: true,
          enabled: true,
          publishedAt: "2026-08-15T16:14:00.000Z",
          status: "published",
          transition,
          ...publication,
        },
        singular: "Article",
        title: "Release notes",
      }}
    >
      <ContentFormStatusSwitch />
    </ContentFormProvider>,
    { wrapper },
  );

  return { transition };
};

describe("ContentFormStatusSwitch", () => {
  it("checks the current status", () => {
    renderSwitch();

    expect(
      screen
        .getByRole("radio", { name: "core.content.status.published" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "core.content.status.draft" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("asks before moving a published item to drafts", async () => {
    const { transition } = renderSwitch();

    fireEvent.click(
      screen.getByRole("radio", { name: "core.content.status.draft" }),
    );

    expect(
      await screen.findByText("core.content.unpublish.title"),
    ).toBeTruthy();
    expect(transition).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.unpublish.confirm" }),
    );

    await waitFor(() => {
      expect(transition).toHaveBeenCalledWith("unpublish");
    });
  });

  it("publishes a draft after confirmation", async () => {
    const { transition } = renderSwitch({ status: "draft" });

    fireEvent.click(
      screen.getByRole("radio", { name: "core.content.status.published" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.content.publish.confirm",
      }),
    );

    await waitFor(() => {
      expect(transition).toHaveBeenCalledWith("publish");
    });
  });

  it("does nothing for staff without the publish permission", () => {
    const { transition } = renderSwitch({ canPublish: false });

    fireEvent.click(
      screen.getByRole("radio", { name: "core.content.status.draft" }),
    );

    expect(screen.queryByText("core.content.unpublish.title")).toBeNull();
    expect(transition).not.toHaveBeenCalled();
  });

  it("renders nothing while creating", () => {
    render(
      <ContentFormProvider
        value={{
          fieldNames: [],
          fields: {},
          localizedFieldNames: [],
          mode: "create",
          publication: { canPublish: true, enabled: true },
          singular: "Article",
        }}
      >
        <ContentFormStatusSwitch />
      </ContentFormProvider>,
      { wrapper },
    );

    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
