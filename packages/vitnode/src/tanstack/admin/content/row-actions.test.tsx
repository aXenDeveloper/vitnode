import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { requestHandler } from "@tanstack/react-start/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { IntlProvider } from "use-intl";
import {
  afterEach,
  aroundEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

import type { ContentDuplicatedRecord } from "./row-actions";

import { ContentRowActions } from "./row-actions";

const PLUGIN = "@vitnode/blog";

const articles = defineContentType({
  id: "blog.post",
  tableName: "blog_posts",
  publication: { enabled: true },
  visibility: { enabled: true },
  duplication: { enabled: true },
  editorial: { enabled: true },
  fields: {
    title: field.text({ required: true, maxLength: 255 }),
    sku: field.text({ required: true, unique: true }),
  },
  admin: { titleField: "title", permissionModule: "posts" },
});

const entry: RegisteredFrontendContentType = {
  definition: articles,
  pluginId: PLUGIN,
  registration: { definition: articles },
};

const row = (overrides: Partial<ContentRowData> = {}): ContentRowData => ({
  hiddenAt: null,
  id: 7,
  labels: {},
  status: "published",
  title: "Release notes",
  version: 4,
  ...overrides,
});

const grant = (...permissions: string[]): PermissionsStaffArgs[] =>
  permissions.map(permission => ({
    module: "posts",
    permission,
    plugin: PLUGIN,
  }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

let respond: (init?: RequestInit) => Response = () => json(200, {});

const fetchMock = vi.fn(
  async (_url: RequestInfo | URL, init?: RequestInit) =>
    await Promise.resolve(respond(init)),
);

const sent = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    body:
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as unknown)
        : undefined,
    method: init?.method?.toUpperCase(),
    path: new URL(url instanceof Request ? url.url : url).pathname,
  }));

const mount = ({
  onDuplicated,
  permissions,
  record = row(),
}: {
  onDuplicated?: (copy: ContentDuplicatedRecord) => void;
  permissions: PermissionsStaffArgs[];
  record?: ContentRowData;
}) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QueryClientProvider client={new QueryClient()}>
        <AdminStaffPermissionProvider value={{ permissions, root: false }}>
          <ContentRowActions
            entry={entry}
            labelField={name => (name === "sku" ? "SKU" : name)}
            locale="en"
            onDuplicated={onDuplicated}
            row={record}
            singular="Article"
          />
        </AdminStaffPermissionProvider>
      </QueryClientProvider>
    </IntlProvider>,
  );

const API_ORIGIN = "http://api.test";

/**
 * The universal fetcher runs its server half under vitest, which reads the
 * request it is rendering inside - so each test runs inside one, the way
 * `mutations-api.test.ts` does.
 */
aroundEach(async runTest => {
  await requestHandler(async () => {
    await runTest();

    return new Response(null, { status: 204 });
  })(new Request(`${API_ORIGIN}/admin/content/blog/articles`), undefined);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubEnv("VITNODE_API_URL", API_ORIGIN);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ContentRowActions - permission gating", () => {
  it("offers Duplicate and Hide to an editor who may create, view and hide", () => {
    mount({ permissions: grant("can_view", "can_create", "can_hide") });

    expect(
      screen.getByRole("button", { name: "core.content.actions.duplicate" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "core.content.actions.hide" }),
    ).toBeTruthy();
  });

  it("offers no Duplicate without can_create", () => {
    mount({ permissions: grant("can_view", "can_hide") });

    expect(
      screen.queryByRole("button", { name: "core.content.actions.duplicate" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "core.content.actions.hide" }),
    ).toBeTruthy();
  });

  it("offers no Hide without can_hide - can_publish is not enough", () => {
    mount({ permissions: grant("can_view", "can_create", "can_publish") });

    expect(
      screen.queryByRole("button", { name: "core.content.actions.hide" }),
    ).toBeNull();
  });

  it("offers Unhide for a hidden row", () => {
    mount({
      permissions: grant("can_hide"),
      record: row({ hiddenAt: "2026-10-01T09:00:00.000Z" }),
    });

    expect(
      screen.getByRole("button", { name: "core.content.actions.unhide" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "core.content.actions.hide" }),
    ).toBeNull();
  });
});

describe("ContentRowActions - hide", () => {
  it("hides with the row's version after the confirmation, then says so", async () => {
    const success = vi.spyOn(toast, "success");
    respond = () => json(200, { changed: true, row: row({ version: 5 }) });
    mount({ permissions: grant("can_hide") });

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.hide" }),
    );
    expect(await screen.findByText("core.content.hide.desc")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.hide.confirm" }),
    );

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith("core.content.hide.success", {
        description: "Release notes",
      });
    });
    expect(sent()[0]).toEqual({
      body: { expectedVersion: 4 },
      method: "POST",
      path: "/api/@vitnode/blog/admin/content/posts/7/hide",
    });
  });

  it("explains a version conflict instead of hiding", async () => {
    const error = vi.spyOn(toast, "error");
    respond = () =>
      json(409, {
        code: "CONTENT_VERSION_CONFLICT",
        contentTypeId: "blog.post",
        currentVersion: 6,
        expectedVersion: 4,
        itemId: 7,
      });
    mount({ permissions: grant("can_hide") });

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.hide" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "core.content.hide.confirm" }),
    );

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        "core.content.visibility.conflict.title",
        { description: "core.content.visibility.conflict.desc" },
      );
    });
  });
});

describe("ContentRowActions - duplicate", () => {
  it("copies the row, names the copy, and hands it to the list", async () => {
    const success = vi.spyOn(toast, "success");
    const onDuplicated = vi.fn();
    const copy = row({
      id: 8,
      status: "draft",
      title: "Release notes (Copy)",
      version: 1,
    });
    respond = init =>
      init?.method?.toUpperCase() === "POST"
        ? json(201, {
            id: 8,
            locales: [],
            row: copy,
            skippedLocales: [],
            sourceId: 7,
          })
        : json(200, copy);
    mount({
      onDuplicated,
      permissions: grant("can_view", "can_create"),
    });

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.duplicate" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.content.duplicate.confirm",
      }),
    );

    await waitFor(() => {
      expect(onDuplicated).toHaveBeenCalledTimes(1);
    });
    expect(onDuplicated.mock.calls[0]?.[0]).toMatchObject({
      id: 8,
      title: "Release notes (Copy)",
    });
    expect(success).toHaveBeenCalledWith("core.content.duplicate.success", {
      description: "Release notes (Copy)",
    });
    expect(sent()[0]).toMatchObject({
      method: "POST",
      path: "/api/@vitnode/blog/admin/content/posts/7/duplicate",
    });
  });

  it("names the unique field a copy cannot reuse", async () => {
    const error = vi.spyOn(toast, "error");
    const onDuplicated = vi.fn();
    respond = () =>
      json(422, {
        code: "CONTENT_DUPLICATE_UNIQUE_REQUIRED",
        contentTypeId: "blog.post",
        fields: ["sku"],
      });
    mount({ onDuplicated, permissions: grant("can_view", "can_create") });

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.actions.duplicate" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.content.duplicate.confirm",
      }),
    );

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith("core.global.errors.title", {
        description: "core.content.duplicate.errors.unique_required",
      });
    });
    expect(onDuplicated).not.toHaveBeenCalled();
    expect(screen.getByText("core.content.duplicate.title")).toBeTruthy();
  });
});
