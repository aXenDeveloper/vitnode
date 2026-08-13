import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublishContentAction } from "./publish-action";

const publish = vi.fn();
const unpublish = vi.fn();
const success = vi.fn();
const error = vi.fn();
let canPublish = true;

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    t.rich = (key: string) => `${namespace}.${key}`;

    return t;
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => error(...args),
    success: (...args: unknown[]) => success(...args),
  },
}));

vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => canPublish,
}));

vi.mock("./mutation-api.server", () => ({
  publishContentAction: async (...args: unknown[]) => {
    await Promise.resolve();

    return publish(...args) as unknown;
  },
  unpublishContentAction: async (...args: unknown[]) => {
    await Promise.resolve();

    return unpublish(...args) as unknown;
  },
}));

const renderAction = (status: string) =>
  render(
    <PublishContentAction
      contentTypeId="test.post"
      id={7}
      permissionModule="posts"
      pluginId="@vitnode/example"
      singular="Post"
      status={status}
      title="Hello world"
    />,
  );

beforeEach(() => {
  canPublish = true;
  publish.mockReset().mockResolvedValue({});
  unpublish.mockReset().mockResolvedValue({});
  success.mockReset();
  error.mockReset();
});

describe("PublishContentAction", () => {
  it("offers Publish for a draft", () => {
    renderAction("draft");

    expect(
      screen.getByRole("button", { name: "core.content.actions.publish" }),
    ).toBeDefined();
  });

  it("offers Unpublish for a published row", () => {
    renderAction("published");

    expect(
      screen.getByRole("button", { name: "core.content.actions.unpublish" }),
    ).toBeDefined();
  });

  it("renders nothing without can_publish", () => {
    // Gated by `can_publish`, never by `can_edit` - a role may write drafts
    // without being allowed to put them on the internet.
    canPublish = false;
    const { container } = renderAction("draft");

    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("labels the button for screen readers", () => {
    renderAction("draft");

    expect(
      screen
        .getByRole("button", { name: "core.content.actions.publish" })
        .getAttribute("aria-label"),
    ).toBe("core.content.actions.publish");
  });

  describe("confirmation", () => {
    it("asks before publishing, and does not fire until confirmed", async () => {
      renderAction("draft");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.publish" }),
      );

      expect(
        await screen.findByRole("alertdialog", undefined, { timeout: 3000 }),
      ).toBeDefined();
      // Opening the dialog is not the mutation.
      expect(publish).not.toHaveBeenCalled();
    });

    it("publishes when confirmed, and reports it", async () => {
      renderAction("draft");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.publish" }),
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "core.content.publish.confirm" },
          { timeout: 3000 },
        ),
      );

      await waitFor(() => {
        expect(publish).toHaveBeenCalledWith("test.post", 7);
      });
      expect(unpublish).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(success).toHaveBeenCalledWith("core.content.publish.success", {
          description: "Hello world",
        });
      });
    });

    it("unpublishes a published row", async () => {
      renderAction("published");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.unpublish" }),
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "core.content.unpublish.confirm" },
          { timeout: 3000 },
        ),
      );

      await waitFor(() => {
        expect(unpublish).toHaveBeenCalledWith("test.post", 7);
      });
      expect(publish).not.toHaveBeenCalled();
    });

    it("shows the mapped message on failure", async () => {
      publish.mockResolvedValue({ error: "", status: 403 });
      renderAction("draft");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.publish" }),
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "core.content.publish.confirm" },
          { timeout: 3000 },
        ),
      );

      await waitFor(() => {
        expect(error).toHaveBeenCalledWith("core.global.errors.title", {
          description: "core.content.errors.forbidden",
        });
      });
      expect(success).not.toHaveBeenCalled();
    });

    it("falls back to the server-error message for an unmapped status", async () => {
      publish.mockResolvedValue({ error: "", status: 500 });
      renderAction("draft");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.publish" }),
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "core.content.publish.confirm" },
          { timeout: 3000 },
        ),
      );

      await waitFor(() => {
        expect(error).toHaveBeenCalledWith("core.global.errors.title", {
          description: "core.global.errors.internal_server_error",
        });
      });
    });

    it("stays open on failure and closes on success", async () => {
      publish.mockResolvedValue({ error: "", status: 500 });
      renderAction("draft");

      fireEvent.click(
        screen.getByRole("button", { name: "core.content.actions.publish" }),
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "core.content.publish.confirm" },
          { timeout: 3000 },
        ),
      );

      await waitFor(() => {
        expect(error).toHaveBeenCalled();
      });
      // The reason stays on screen next to the thing that failed.
      expect(screen.queryByRole("alertdialog")).not.toBeNull();

      publish.mockResolvedValue({});
      fireEvent.click(
        screen.getByRole("button", { name: "core.content.publish.confirm" }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });
  });
});
