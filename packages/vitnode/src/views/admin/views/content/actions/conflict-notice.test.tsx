import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;

    return t;
  },
}));

const { ConflictNotice } = await import("./conflict-notice");

const spec: ContentFormSpec = {
  contentTypeId: "test.editorial",
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
      label: "Excerpt",
      name: "excerpt",
      nullable: true,
      required: false,
    },
  ],
  pluginId: "@vitnode/test",
  titleField: "title",
};

const opened = { excerpt: "Original excerpt", id: 7, title: "Original title" };

let onReload: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  onReload = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
});

describe("ConflictNotice", () => {
  it("names the version the record moved to", () => {
    render(
      <ConflictNotice
        conflict={{ currentVersion: 9 }}
        onReload={onReload}
        opened={opened}
        spec={spec}
      />,
    );

    expect(screen.getByText("core.content.conflict.title")).not.toBeNull();
  });

  it("offers to show what changed, and asks before doing anything", async () => {
    render(
      <ConflictNotice
        conflict={{ currentVersion: 9 }}
        onReload={onReload}
        opened={opened}
        spec={spec}
      />,
    );

    // Nothing is reloaded, merged or overwritten until the editor asks.
    expect(onReload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("core.content.conflict.reload"));

    await waitFor(() => {
      expect(onReload).toHaveBeenCalledTimes(1);
    });
  });

  it("lists only the fields another session actually changed", () => {
    render(
      <ConflictNotice
        conflict={{
          currentVersion: 9,
          latest: {
            excerpt: "Original excerpt",
            id: 7,
            title: "Someone else's title",
          },
        }}
        onReload={onReload}
        opened={opened}
        spec={spec}
      />,
    );

    expect(screen.getByText("Title")).not.toBeNull();
    expect(screen.getByText("Someone else's title")).not.toBeNull();
    // Unchanged, so it is not noise in the list.
    expect(screen.queryByText("Excerpt")).toBeNull();
  });

  it("shows no diff when the remote record matches", () => {
    render(
      <ConflictNotice
        conflict={{ currentVersion: 9, latest: { ...opened } }}
        onReload={onReload}
        opened={opened}
        spec={spec}
      />,
    );

    expect(screen.queryByText("Title")).toBeNull();
  });

  it("renders an absent value as the empty marker rather than 'undefined'", () => {
    render(
      <ConflictNotice
        conflict={{
          currentVersion: 9,
          latest: { excerpt: null, id: 7, title: "Original title" },
        }}
        onReload={onReload}
        opened={opened}
        spec={spec}
      />,
    );

    expect(screen.getByText("Excerpt")).not.toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });
});
