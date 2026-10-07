import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import { type ContentFormContextValue, ContentFormProvider } from "./context";
import { ContentFormStatus } from "./primitives";
import { ContentFormStatusSwitch } from "./status-switch";
import { ContentFormVisibilityToggle } from "./visibility";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" timeZone="UTC">
    {children}
  </IntlProvider>
);

const HIDDEN_AT = "2026-10-01T09:00:00.000Z";

const renderForm = (
  children: React.ReactNode,
  {
    mode = "edit",
    publication = {},
    visibility = {},
  }: {
    mode?: ContentFormContextValue["mode"];
    publication?: Partial<ContentFormContextValue["publication"]>;
    visibility?: Partial<NonNullable<ContentFormContextValue["visibility"]>>;
  } = {},
) => {
  const transition = vi.fn(async () => Promise.resolve(true));
  const publish = vi.fn(async () => Promise.resolve(true));

  render(
    <ContentFormProvider
      value={{
        fieldNames: [],
        fields: {},
        localizedFieldNames: [],
        mode,
        publication: {
          canPublish: true,
          enabled: true,
          publishedAt: "2026-08-15T16:14:00.000Z",
          status: "published",
          transition: publish,
          ...publication,
        },
        singular: "Article",
        title: "Release notes",
        visibility: {
          canHide: true,
          enabled: true,
          hiddenAt: null,
          transition,
          ...visibility,
        },
      }}
    >
      {children}
    </ContentFormProvider>,
    { wrapper },
  );

  return { publish, transition };
};

describe("ContentFormVisibilityToggle", () => {
  it("hides a visible record after the confirmation", async () => {
    const { transition } = renderForm(<ContentFormVisibilityToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.hide" }),
    );

    expect(await screen.findByText("core.content.hide.desc")).toBeTruthy();
    expect(transition).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.hide.confirm" }),
    );

    await waitFor(() => {
      expect(transition).toHaveBeenCalledWith("hide");
    });
  });

  it("offers to unhide a hidden record", async () => {
    const { transition } = renderForm(<ContentFormVisibilityToggle />, {
      visibility: { hiddenAt: HIDDEN_AT },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.unhide" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.content.unhide.confirm",
      }),
    );

    await waitFor(() => {
      expect(transition).toHaveBeenCalledWith("unhide");
    });
  });

  it.each([
    ["without can_hide", { visibility: { canHide: false } }],
    [
      "for a content type without visibility",
      { visibility: { enabled: false } },
    ],
    ["while creating", { mode: "create" as const }],
  ])("renders nothing %s", (_, options) => {
    renderForm(<ContentFormVisibilityToggle />, options);

    expect(
      screen.queryByRole("button", { name: "core.content.actions.hide" }),
    ).toBeNull();
  });
});

describe("the editor's status", () => {
  it("says Hidden, and why publishing will not help, for a hidden record", () => {
    renderForm(<ContentFormStatus />, { visibility: { hiddenAt: HIDDEN_AT } });

    expect(screen.getByText("core.content.status.published")).toBeTruthy();
    expect(screen.getByText("core.content.visibility.hidden")).toBeTruthy();
    expect(
      screen.getByText("core.content.visibility.hidden_desc"),
    ).toBeTruthy();
  });

  it("says nothing about visibility for a visible record", () => {
    renderForm(<ContentFormStatus />);

    expect(screen.queryByText("core.content.visibility.hidden")).toBeNull();
    expect(
      screen.queryByText("core.content.visibility.hidden_desc"),
    ).toBeNull();
  });

  it("shows the badge beside the status switch, and warns before publishing", async () => {
    const { publish } = renderForm(<ContentFormStatusSwitch />, {
      publication: { status: "draft" },
      visibility: { hiddenAt: HIDDEN_AT },
    });

    expect(screen.getByText("core.content.visibility.hidden")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("radio", { name: "core.content.status.published" }),
    );

    expect(
      await screen.findByText("core.content.visibility.publish_note", {
        exact: false,
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.publish.confirm" }),
    );

    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith("publish");
    });
  });
});
