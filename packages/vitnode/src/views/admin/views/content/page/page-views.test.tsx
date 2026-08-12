import type { ReactElement } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentFormLayout } from "@/lib/plugin";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  // The language the person reads VitNode in. There is no locale control on the
  // screen and nothing in the URL beyond the app's own `[locale]` segment - the
  // form takes its display language from here.
  getLocale: async () => {
    await Promise.resolve();

    return "en";
  },
  getTranslations: async () => {
    await Promise.resolve();

    // `getContentLabels` asks `t.has` before reading, so a plugin that
    // translates nothing still gets readable labels.
    return Object.assign((key: string) => key, { has: () => false });
  },
}));

vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const permissions = new Set<string>();
vi.mock("@/lib/api/get-session-admin-api", () => ({
  checkAdminPermissionApi: async ({ permission }: { permission: string }) => {
    await Promise.resolve();

    return permissions.has(permission);
  },
}));

const fetched = { data: undefined as unknown, status: 200 };
vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async () => {
    await Promise.resolve();

    return fetched;
  },
}));

const notFoundCalls = { count: 0 };
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundCalls.count += 1;
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { ContentCreatePageView, ContentEditPageView } =
  await import("./page-views");

const pageArticle = defineContentType({
  id: "test.page-article",
  tableName: "test_page_articles",
  fields: {
    title: field.text({ required: true, minLength: 1 }),
    excerpt: field.textarea({ nullable: true }),
  },
  admin: {
    label: { plural: "Page Articles", singular: "Page Article" },
    create: { mode: "page" },
    edit: { mode: "page" },
  },
});

const entryOf = (
  registration: Partial<RegisteredFrontendContentType["registration"]> = {},
): RegisteredFrontendContentType => ({
  definition: pageArticle,
  pluginId: "@vitnode/test",
  registration: {
    definition: pageArticle,
    ...registration,
  },
});

/** The `ContentFormPage` element the view returns, wherever it sits. */
const formPage = (
  element: ReactElement,
): ReactElement<Record<string, unknown>> => {
  const walk = (
    node: unknown,
  ): null | ReactElement<Record<string, unknown>> => {
    if (node === null || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }

      return null;
    }
    if (!("props" in node)) return null;

    const element = node as ReactElement<Record<string, unknown>>;
    if ("spec" in element.props && "backHref" in element.props) return element;

    return walk(element.props.children);
  };

  const found = walk(element);
  if (!found) throw new Error("No ContentFormPage in the rendered tree.");

  return found;
};

const render = async (view: Promise<ReactElement>) =>
  formPage(await view).props;

beforeEach(() => {
  permissions.clear();
  notFoundCalls.count = 0;
  fetched.status = 200;
  fetched.data = { id: 7, labels: {}, title: "Hello" };
});

describe("the generated create page", () => {
  it("renders the generated form for someone who may create", async () => {
    permissions.add("can_view");
    permissions.add("can_create");

    const props = await render(ContentCreatePageView({ entry: entryOf() }));

    expect(props.backHref).toBe("/admin/content/test/page-article");
    expect(props.layout).toBeUndefined();
    expect((props.spec as { fields: { name: string }[] }).fields).toHaveLength(
      2,
    );
  });

  it("hands a new record over to its own edit page", async () => {
    permissions.add("can_view");
    permissions.add("can_create");

    const props = await render(ContentCreatePageView({ entry: entryOf() }));

    expect(props.createdHrefTemplate).toBe(
      "/admin/content/test/page-article/{id}/edit",
    );
  });

  it("goes back to the list when there is no edit page to go to", async () => {
    permissions.add("can_view");
    permissions.add("can_create");
    const dialogEdit = defineContentType({
      id: "test.page-article",
      tableName: "test_page_articles",
      fields: { title: field.text({ required: true }) },
      admin: {
        label: { plural: "Page Articles", singular: "Page Article" },
        create: { mode: "page" },
      },
    });

    const props = await render(
      ContentCreatePageView({
        entry: {
          ...entryOf(),
          definition: dialogEdit,
        },
      }),
    );

    expect(props.createdHrefTemplate).toBeUndefined();
  });

  it("404s without can_create, however the URL was reached", async () => {
    permissions.add("can_view");

    await expect(ContentCreatePageView({ entry: entryOf() })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundCalls.count).toBe(1);
  });

  it("404s without can_view", async () => {
    permissions.add("can_create");

    await expect(ContentCreatePageView({ entry: entryOf() })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("uses the registered layout when there is one", async () => {
    permissions.add("can_view");
    permissions.add("can_create");
    const layout: ContentFormLayout = () => null;

    const props = await render(
      ContentCreatePageView({ entry: entryOf({ forms: { layout } }) }),
    );

    expect(props.layout).toBe(layout);
  });

  it("carries the field overrides into the layout's fields", async () => {
    permissions.add("can_view");
    permissions.add("can_create");
    const component = () => null;

    const props = await render(
      ContentCreatePageView({
        entry: entryOf({
          fields: { title: { component } },
          forms: { layout: () => null },
        }),
      }),
    );

    expect(props.fieldOverrides).toEqual({ title: component });
  });
});

describe("the generated edit page", () => {
  it("opens on the record the URL named", async () => {
    permissions.add("can_view");
    permissions.add("can_edit");

    const props = await render(
      ContentEditPageView({ entry: entryOf(), itemId: 7 }),
    );

    expect(props.data).toMatchObject({ id: 7 });
    expect(props.title).toBe("Hello");
  });

  it("404s for a record that is not there", async () => {
    permissions.add("can_view");
    permissions.add("can_edit");
    fetched.status = 404;
    fetched.data = undefined;

    await expect(
      ContentEditPageView({ entry: entryOf(), itemId: 99 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s without can_edit on a content type with no translations", async () => {
    permissions.add("can_view");
    permissions.add("can_translate");

    await expect(
      ContentEditPageView({ entry: entryOf(), itemId: 7 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("opens for a translator on a localized content type", async () => {
    permissions.add("can_view");
    permissions.add("can_translate");

    const localized = defineContentType({
      id: "test.page-localized",
      tableName: "test_page_localized",
      localization: { enabled: true, defaultLocale: "en" },
      fields: {
        featured: field.boolean({ defaultValue: false }),
        title: field.text({ localized: true, required: true }),
      },
      admin: {
        label: { plural: "Pages", singular: "Page" },
        create: { mode: "page" },
        edit: { mode: "page" },
      },
    });

    const props = await render(
      ContentEditPageView({
        entry: {
          ...entryOf(),
          definition: localized,
        },
        itemId: 7,
      }),
    );

    // One form, with the localized fields in it and flagged as such - so each
    // one renders its own language switcher. There is no second spec and no
    // second surface for a translator to be sent to.
    expect(props.spec).toMatchObject({ defaultLocale: "en" });
    expect(
      (props.spec as { fields: { localized?: boolean; name: string }[] })
        .fields,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ localized: true, name: "title" }),
        // The shared field is in the same list, which is the whole point.
        expect.objectContaining({ name: "featured" }),
      ]),
    );
  });

  it("uses the edit layout, not the create one", async () => {
    permissions.add("can_view");
    permissions.add("can_edit");
    const create: ContentFormLayout = () => null;
    const edit: ContentFormLayout = () => null;

    const props = await render(
      ContentEditPageView({
        entry: entryOf({
          forms: { create: { layout: create }, edit: { layout: edit } },
        }),
        itemId: 7,
      }),
    );

    expect(props.layout).toBe(edit);
  });
});
