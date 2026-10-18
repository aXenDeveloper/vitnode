import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemAutoFormComponentProps } from "../components/form/auto-form";
import type { AnyContentContainerDefinition } from "../content/containers/types";
import type { ContentId } from "../content/ids";
import type {
  AnyContentTypeDefinition,
  ContentSelect,
  ContentSystemField,
} from "../content/types";
import type { PluginRoutes } from "../routing/tree";
import type { AdminNavItem as ResolvedAdminNavItem } from "../views/admin/layouts/sidebar/nav/nav-model";
import type { ContentFormSkeletonControl } from "../views/admin/views/content/form/skeleton";
import type { LocaleFilesMap, LocaleMessagesMap } from "./i18n/types";
import type { PluginManifest } from "./plugin-manifest";

import { assertPluginManifest } from "./plugin-manifest";

/**
 * An admin staff permission a plugin's navigation item or dashboard widget
 * requires. The plugin is implied: it is always checked against the plugin that
 * declared the item, so a permission granted under another plugin never
 * reveals it.
 */
export type AdminNavPermission = Omit<PermissionsStaffArgs, "plugin">;

interface AdminNavItem extends Pick<
  ResolvedAdminNavItem,
  "href" | "icon" | "isOpenInNewTab"
> {
  /**
   * Builds the item's title key: `{pluginId}.admin.nav.{id}` in the plugin's
   * frontend messages (`{pluginId}.admin.nav.{parentId}.{id}` for a sub-item).
   */
  id: string;
  /** Hides the item from admins without this permission. Omit to show it to every admin. */
  permission?: AdminNavPermission;
}

/**
 * A link a plugin adds to its own AdminCP sidebar group, below the entries of
 * its content types and containers.
 *
 * A parent with `items` is hidden when the admin may see none of them.
 *
 * @example
 * ```ts
 * admin: {
 *   nav: [
 *     {
 *       id: "reports",
 *       href: "/admin/blog/reports",
 *       icon: <FlagIcon />,
 *       permission: { module: "reports", permission: "can_view" },
 *     },
 *   ],
 * },
 * ```
 */
export type AdminNavDeclaration = AdminNavItem & {
  /** Nested links. Sub-items have no icon. */
  items?: Omit<AdminNavItem, "icon">[];
};

/** A content type, as much of it as the sidebar reads: what it is, and its icon. */
export type AdminNavContentType = Pick<
  ContentTypeFrontendRegistration,
  "definition" | "icon"
>;

/** A content container the AdminCP lists in the plugin's sidebar group. */
export interface ContentContainerFrontendRegistration {
  /** The same definition the plugin registers on its API. */
  definition: AnyContentContainerDefinition;
  /** Sidebar icon. */
  icon?: React.ReactNode;
}

/**
 * A plugin's AdminCP sidebar group - its content types, containers and extra
 * links - plus the widgets it offers on the AdminCP dashboard. A plugin exports
 * it as `adminNav` from its `admin/nav` module; the VitNode Vite plugin
 * discovers that export and lists it in the app's generated
 * `src/admin-nav.gen.ts`, which the AdminCP shell loads. Browser-safe.
 *
 * @example
 * ```tsx
 * // src/admin/nav.tsx
 * export const adminNav = {
 *   pluginId: manifest.id,
 *   contentTypes: [{ definition: blogPostContentType, icon: <NotebookPenIcon /> }],
 * } satisfies AdminNavPluginSource;
 * ```
 */
export interface AdminNavPluginSource {
  admin?: {
    dashboard?: {
      /**
       * Widgets this plugin offers on the AdminCP dashboard. Their strings
       * live under `{pluginId}.admin.dashboard.widgets` in the plugin's
       * frontend messages.
       */
      widgets?: AdminDashboardWidget[];
    };
    /** Extra links in the plugin's sidebar group. */
    nav?: AdminNavDeclaration[];
  };
  containers?: ContentContainerFrontendRegistration[];
  contentTypes?: AdminNavContentType[];
  pluginId: string;
}

/** How many of the dashboard grid's three columns a widget covers. */
export type AdminDashboardWidgetSpan = 1 | 2 | 3;
/** How many grid rows a widget covers. */
export type AdminDashboardWidgetRows = 1 | 2 | 3;
/** A widget instance's own settings, saved with the admin's dashboard layout. */
export type AdminDashboardWidgetSettings = Record<string, unknown>;

export interface AdminDashboardWidgetProps {
  /** This instance's saved settings; `{}` until the admin changes any. */
  settings: AdminDashboardWidgetSettings;
  /** The instance id, unique on the board even when the widget allows several copies. */
  widgetId: string;
}

/**
 * A widget a plugin offers on the AdminCP dashboard. Admins add, remove,
 * resize and reorder widgets themselves; the layout is saved per admin.
 *
 * Its title comes from `{pluginId}.admin.dashboard.widgets.{id}.title` and its
 * optional description from `...{id}.desc` in the plugin's frontend messages.
 */
export interface AdminDashboardWidget {
  /** Lets an admin place more than one copy, each with its own settings. */
  allowMultiple?: boolean;
  /**
   * Groups the widget in the "add widget" panel, titled by
   * `{pluginId}.admin.dashboard.widgets.categories.{category}` (the raw value
   * when that key is missing). Defaults to a group named after the plugin.
   */
  category?: string;
  /** Renders the widget's body. */
  component: React.ComponentType<AdminDashboardWidgetProps>;
  /**
   * Placed automatically, at the end of the board, for admins who have never
   * seen this widget. Admins who removed it keep it removed.
   */
  defaultEnabled?: boolean;
  /** Height when first placed. Defaults to `1`. */
  defaultRows?: AdminDashboardWidgetRows;
  /** Width when first placed. Defaults to `minSpan`. */
  defaultSpan?: AdminDashboardWidgetSpan;
  icon?: React.ReactNode;
  /** Unique within the plugin; the board namespaces it as `{pluginId}:{id}`. */
  id: string;
  /** The narrowest the admin can resize it to. Defaults to `1`. */
  minSpan?: AdminDashboardWidgetSpan;
  /** Hides the widget from admins without this permission. */
  permission?: AdminNavPermission;
  /** A form for this instance's `settings`, shown when the admin edits the widget. */
  settingsComponent?: React.ComponentType<AdminDashboardWidgetProps>;
}

/** Props of a custom AdminCP list cell, registered through {@link contentTypeAdmin}. */
export interface ContentCellProps<
  TDefinition extends AnyContentTypeDefinition = AnyContentTypeDefinition,
> {
  /** The record the row shows, as the admin list returns it. */
  row: ContentSelect<TDefinition>;
}

/** What a custom create/edit form layout is told about the form it wraps. */
export interface ContentFormLayoutProps {
  contentTypeId: string;
  /** The record being edited; `undefined` while creating. */
  itemId?: ContentId;
  mode: "create" | "edit";
  pluginId: string;
  /** Whether the content type has the draft/published lifecycle. */
  publication: boolean;
  singular: string;
  /** The record's resolved title while editing, for headings. */
  title?: string;
}

/**
 * A component that replaces the generated create/edit page around a content
 * type's form. It changes presentation only: the fields, validation and saving
 * stay the Content Engine's.
 */
export type ContentFormLayout = (
  props: ContentFormLayoutProps,
) => React.ReactNode;

/** Custom form layouts for a content type's AdminCP create and edit pages. */
export interface ContentTypeFormsRegistration {
  /** The create page's layout, overriding `layout`. */
  create?: { layout?: ContentFormLayout };
  /** The edit page's layout, overriding `layout`. */
  edit?: { layout?: ContentFormLayout };
  /** Used by both create and edit unless one of them overrides it. */
  layout?: ContentFormLayout;
}

/** The layout for one action, or `undefined` for the generated one. */
export const resolveContentFormLayout = (
  forms: ContentTypeFormsRegistration | undefined,
  mode: "create" | "edit",
): ContentFormLayout | undefined =>
  forms?.[mode]?.layout ?? forms?.layout ?? undefined;

/**
 * A content type registration once its definition generic has been erased, so
 * one plugin can list content types with different field maps in one array.
 */
export interface ContentTypeFrontendRegistration {
  columns?: Record<
    string,
    { cell: (props: ContentCellProps) => React.ReactNode }
  >;
  definition: AnyContentTypeDefinition;
  fields?: Record<
    string,
    {
      component: (props: ItemAutoFormComponentProps) => React.ReactNode;
      skeleton?: ContentFormSkeletonControl;
    }
  >;
  /** Custom create/edit form layouts. Presentation only - see `forms`. */
  forms?: ContentTypeFormsRegistration;
  icon?: React.ReactNode;
}

/**
 * A plugin's Content Engine AdminCP screens: custom cells, fields and form
 * layouts per content type. A plugin exports it as `adminContent` from its
 * `admin/content` module; the VitNode Vite plugin lists it in the app's
 * generated `src/content-registry.gen.ts`, which the app loads lazily before an
 * `/admin/content` route runs. Browser-safe, but heavy - it carries editor code.
 */
export interface ContentFrontendPluginSource {
  containers?: ContentContainerFrontendRegistration[];
  contentTypes?: ContentTypeFrontendRegistration[];
  pluginId: string;
}

interface TypedContentTypeRegistration<
  TDefinition extends AnyContentTypeDefinition,
> {
  /** Replace the generated DataTable cell for a column. */
  columns?: Partial<
    Record<
      ContentSystemField | (keyof TDefinition["fields"] & string),
      { cell: (props: ContentCellProps<TDefinition>) => React.ReactNode }
    >
  >;
  /** The content type definition the plugin also registers on its API. */
  definition: TDefinition;
  /** Replace the generated AutoForm component for a field. */
  fields?: Partial<
    Record<
      keyof TDefinition["fields"] & string,
      {
        component: (props: ItemAutoFormComponentProps) => React.ReactNode;
        /** The loading placeholder shown while the form loads. */
        skeleton?: ContentFormSkeletonControl;
      }
    >
  >;

  /** Custom create/edit form layouts. Presentation only. */
  forms?: ContentTypeFormsRegistration;
  /** Sidebar icon. Defaults to a generic document icon. */
  icon?: React.ReactNode;
}

/**
 * Registers a content type's AdminCP customizations - list cells, form fields,
 * form layouts and the sidebar icon - in a plugin's `adminContent`
 * ({@link ContentFrontendPluginSource}).
 *
 * It only exists for type checking: `columns` and `fields` are keyed by the
 * definition's own field names, and the result is widened so content types with
 * different fields fit in one array. Everything else about the admin screens
 * comes from the definition itself.
 *
 * @example
 * ```tsx
 * // src/admin/content.tsx
 * import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";
 *
 * import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
 *
 * export const adminContent = {
 *   pluginId: manifest.id,
 *   contentTypes: [
 *     contentTypeAdmin({
 *       definition: blogCategoryContentType,
 *       fields: { color: { component: CategoryColorField } },
 *       columns: { color: { cell: CategoryColorCell } },
 *     }),
 *   ],
 * } satisfies ContentFrontendPluginSource;
 * ```
 */
export function contentTypeAdmin<TDefinition extends AnyContentTypeDefinition>(
  registration: TypedContentTypeRegistration<TDefinition>,
): ContentTypeFrontendRegistration {
  return registration as ContentTypeFrontendRegistration;
}

/**
 * A plugin's frontend half, as {@link buildPlugin} returns it and an app's
 * `buildConfig({ plugins })` receives it.
 */
export interface BuildPluginReturn<P extends string = string> {
  /** What the plugin adds to the AdminCP. */
  admin?: {
    dashboard?: {
      /**
       * Widgets this plugin offers for the AdminCP dashboard, for hosts that
       * build the AdminCP from the config. A TanStack Start app reads them
       * from the plugin's `adminNav` instead ({@link AdminNavPluginSource}).
       */
      widgets?: AdminDashboardWidget[];
    };
    /**
     * Extra links in the plugin's sidebar group, for hosts that build the
     * navigation from the config. Usually declared on `adminNav` instead.
     */
    nav?: AdminNavDeclaration[];
  };
  /** Content containers listed in the plugin's sidebar group. */
  containers?: ContentContainerFrontendRegistration[];
  /**
   * Content types listed in the plugin's sidebar group, for hosts that build
   * the AdminCP navigation from the config itself. A TanStack Start app reads
   * them from the plugin's `admin/nav` and `admin/content` modules instead - see
   * {@link AdminNavPluginSource} and {@link ContentFrontendPluginSource}.
   */
  contentTypes?: ContentTypeFrontendRegistration[];
  /**
   * Every locale file this plugin ships, as literal `*.json` specifiers an
   * app's bundler can resolve - `{ en: "@acme/blog/locales/en.json" }`.
   *
   * Declared rather than derived from `pluginId`, because where a package keeps
   * its JSON is the package's own business and its `exports` map is what
   * decides whether a path resolves at all.
   *
   * This is what an app's translations are actually loaded from. `messages`
   * below is the plugin's own barrel, whose `import("./en.json")` is relative
   * to the plugin's build output and so is a specifier no host bundler can
   * follow.
   */
  localeFiles?: LocaleFilesMap;
  /** The plugin's generated manifest (`src/manifest.gen.ts`). */
  manifest?: PluginManifest<P>;
  /**
   * Lazy loaders for the plugin's frontend messages, keyed by locale code -
   * usually the plugin's `src/locales` barrel. Deep-merged into the app's
   * messages as they are, so each file nests its keys under the plugin id
   * itself. Bundled apps load `localeFiles` instead.
   */
  messages?: LocaleMessagesMap;
  /** The plugin's npm package name, taken from `manifest.id`. */
  pluginId: P;

  /** The plugin's pages, mounted into the app's router. */
  routes?: PluginRoutes;
}

/** What {@link buildPlugin} accepts: everything it returns except `pluginId`, with `manifest` required. */
export type BuildPluginOptions<P extends string> = Omit<
  BuildPluginReturn<P>,
  "manifest" | "pluginId"
> & {
  manifest: PluginManifest<P>;
};

/**
 * Declares a plugin's frontend half: its pages and translations. Its API half is declared separately with `buildApiPlugin` from
 * `@vitnode/core/api/lib/plugin`; both take the same generated manifest, whose
 * `id` (the package name) is the plugin id every registration is keyed by.
 *
 * Browser-safe: it is imported by the app's frontend config, so keep server-only
 * code out of everything it references.
 *
 * @throws When `manifest` is malformed: an invalid icon name or update source URL.
 *
 * @example
 * ```ts
 * // src/config.tsx - registered in the app's `buildConfig({ plugins: [blogPlugin()] })`
 * import { buildPlugin } from "@vitnode/core/lib/plugin";
 *
 * import messages from "./locales";
 * import { manifest } from "./manifest.gen";
 * import { routes } from "./routes";
 *
 * export const blogPlugin = () =>
 *   buildPlugin({
 *     manifest,
 *     localeFiles: { en: "@vitnode/blog/locales/en.json" },
 *     messages,
 *     routes,
 *   });
 * ```
 */
export function buildPlugin<const P extends string>({
  manifest,
  ...props
}: BuildPluginOptions<P>): BuildPluginReturn<P> {
  assertPluginManifest(manifest.id, manifest, "buildPlugin()");

  return { ...props, manifest, pluginId: manifest.id };
}
