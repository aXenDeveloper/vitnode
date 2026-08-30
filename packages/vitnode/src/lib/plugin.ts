import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemAutoFormComponentProps } from "../components/form/auto-form";
import type {
  AnyContentTypeDefinition,
  ContentSelect,
  ContentSystemField,
} from "../content/types";
import type { PluginRouteDefinition } from "../routing/types";
import type { ItemNavAdmin } from "../views/admin/layouts/sidebar/nav/item";
import type { LocaleMessagesMap } from "./i18n/types";

export type AdminNavPermission = Omit<PermissionsStaffArgs, "plugin">;

interface AdminNavItem extends Pick<
  React.ComponentProps<typeof ItemNavAdmin>,
  "href" | "icon" | "isOpenInNewTab"
> {
  id: string;
  permission?: AdminNavPermission;
}

/**
 * One hand-declared AdminCP sidebar entry, with whatever sits under it.
 *
 * Named rather than written inline on {@link BuildPluginReturn} because
 * {@link AdminNavPluginSource} needs the same shape: a plugin declares its
 * navigation once, and both the full registration and the browser-safe
 * projection read that one declaration.
 */
export type AdminNavDeclaration = AdminNavItem & {
  items?: Omit<AdminNavItem, "icon">[];
};

/** A content type, as much of it as the sidebar reads: what it is, and its icon. */
export type AdminNavContentType = Pick<
  ContentTypeFrontendRegistration,
  "definition" | "icon"
>;

/**
 * A plugin's AdminCP navigation, and nothing else about the plugin.
 *
 * What a plugin exports from `admin/nav` - a **browser-safe** module - so an
 * application can put its sidebar entries on screen without importing the
 * plugin's frontend registration. That distinction is the whole reason this type
 * exists: `blogPlugin()` registers content types *with their editing screens*
 * attached - a Tiptap field, a form layout, a table cell - which reach core's
 * form stack and, today, `next/dynamic`. A TanStack Start application cannot
 * hold that graph, and it does not need to in order to draw a list of links.
 *
 * So the two are separated by what they carry rather than by a build flag:
 *
 *     config.tsx     the whole registration - screens, field overrides, widgets
 *     admin/nav      the ids, hrefs, permissions, icons and content definitions
 *
 * A content type definition is client-safe by construction (zod and plain data,
 * no Drizzle, no components), and an icon is an element from an icon set. That
 * is the entire payload.
 *
 * Structurally a {@link BuildPluginReturn}, so `adminNavDeclarations` reads a
 * list of these exactly as it reads a list of configured plugins - one
 * navigation model, one set of rules, whichever door the data came through.
 * A plugin writes it once and spreads it into its own `buildPlugin` call, which
 * is what stops the two lists drifting.
 */
export interface AdminNavPluginSource {
  admin?: { nav?: AdminNavDeclaration[] };
  contentTypes?: AdminNavContentType[];
  pluginId: string;
}

export type AdminDashboardWidgetSpan = 1 | 2 | 3;
export type AdminDashboardWidgetRows = 1 | 2 | 3;
export type AdminDashboardWidgetSettings = Record<string, unknown>;

export interface AdminDashboardWidgetProps {
  settings: AdminDashboardWidgetSettings;
  widgetId: string;
}

export interface AdminDashboardWidget {
  allowMultiple?: boolean;
  category?: string;
  component: React.ComponentType<AdminDashboardWidgetProps>;
  defaultEnabled?: boolean;
  defaultRows?: AdminDashboardWidgetRows;
  defaultSpan?: AdminDashboardWidgetSpan;
  icon?: React.ReactNode;
  id: string;
  minSpan?: AdminDashboardWidgetSpan;
  permission?: AdminNavPermission;
  settingsComponent?: React.ComponentType<AdminDashboardWidgetProps>;
}

export interface ContentCellProps<
  TDefinition extends AnyContentTypeDefinition = AnyContentTypeDefinition,
> {
  row: ContentSelect<TDefinition>;
}

/**
 * Everything a custom form layout is handed, and nothing more.
 *
 * Deliberately all serialisable: a layout is a client component referenced from
 * `config.tsx`, which is a **server** module, so React props cross an RSC
 * boundary to reach it. Field elements, the form instance and the submit action
 * are not here for exactly that reason - they come from
 * `useContentForm()`/`ContentFormField`, which are client context and therefore
 * never cross anything.
 *
 * There is no database handle, Drizzle table, Hono context or mutation model in
 * this shape, and there is not going to be: a layout decides where a field
 * appears, and the Content Engine decides what happens when it is submitted.
 */
export interface ContentFormLayoutProps {
  contentTypeId: string;
  /** `undefined` while creating - the record does not exist yet. */
  itemId?: number;
  mode: "create" | "edit";
  pluginId: string;
  /** Whether the content type has the draft/published lifecycle. */
  publication: boolean;
  singular: string;
  /** The record's resolved title while editing, for headings. */
  title?: string;
}

export type ContentFormLayout = (
  props: ContentFormLayoutProps,
) => React.ReactNode;

/**
 * Layout overrides for the generated create and edit forms.
 *
 * `layout` alone covers the common case - one editor screen used for both - and
 * `create`/`edit` override it when they genuinely differ. Normalised by
 * `resolveContentFormLayout`, so nothing downstream has to know about the
 * fallback.
 */
export interface ContentTypeFormsRegistration {
  create?: { layout?: ContentFormLayout };
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
    { component: (props: ItemAutoFormComponentProps) => React.ReactNode }
  >;
  /** Custom create/edit form layouts. Presentation only - see `forms`. */
  forms?: ContentTypeFormsRegistration;
  icon?: React.ReactNode;
}

/**
 * A plugin's Content Engine frontend registration, and nothing else about the
 * plugin.
 *
 * What a plugin exports from `admin/content` - a **browser-safe** module - so an
 * application can render the generated content screens without importing the
 * plugin's whole `buildPlugin` call. The same split {@link AdminNavPluginSource}
 * makes, one level further in:
 *
 *     admin/nav       ids, hrefs, permissions, icons, content definitions
 *     admin/content   the above, plus field, column and form-layout overrides
 *     config.tsx      the whole plugin - messages, routes, API wiring
 *
 * The difference between the first two is what a screen needs over what a link
 * needs. A sidebar entry is a string and an icon; a content *screen* is those
 * plus the components that replace a generated input, a generated table cell and
 * a generated form layout. Both are browser-safe, and neither is the server
 * config: `vitnode.config.ts` carries message loaders and API plugins, which a
 * browser bundle has no business holding.
 *
 * Structurally a subset of {@link BuildPluginReturn}, deliberately, and that is
 * what stops the two lists drifting: a plugin writes its registrations once
 * here, `config.tsx` spreads them into `buildPlugin`, and the Next.js
 * application and the TanStack Start application read the same declarations
 * through two doors. A `BuildPluginReturn[]` also satisfies
 * `ContentFrontendPluginSource[]`, so one registry builder serves both.
 */
export interface ContentFrontendPluginSource {
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
  definition: TDefinition;
  /** Replace the generated AutoForm component for a field. */
  fields?: Partial<
    Record<
      keyof TDefinition["fields"] & string,
      { component: (props: ItemAutoFormComponentProps) => React.ReactNode }
    >
  >;
  /**
   * Replace the generated form **layout** - where the fields are, not what they
   * do.
   *
   * The Content Engine still owns the form schema, the validation, the defaults,
   * the mutation, the version precondition, the structured errors, the toast and
   * the cache invalidation. A layout places `<ContentFormField name="..." />`
   * and `<ContentFormActions />` inside one shared form instance.
   */
  forms?: ContentTypeFormsRegistration;
  /** Sidebar icon. Defaults to a generic document icon. */
  icon?: React.ReactNode;
}

/**
 * Registers a content type with the AdminCP.
 *
 * The `definition` is the *same object* the API plugin registers - it is
 * client-safe by construction (zod and plain data, no Drizzle), so the two
 * sides cannot drift. Component overrides live here rather than on the
 * definition, because the definition is also imported by `src/database/*.ts`,
 * which Drizzle Kit executes.
 *
 * The wrapper exists to type-check `fields` and `columns` against the
 * definition's own field names before erasing the generic - the same shape as
 * `buildEventListener`.
 */
export function contentTypeAdmin<TDefinition extends AnyContentTypeDefinition>(
  registration: TypedContentTypeRegistration<TDefinition>,
): ContentTypeFrontendRegistration {
  return registration as ContentTypeFrontendRegistration;
}

export interface BuildPluginReturn<P extends string = string> {
  admin?: {
    dashboard?: {
      widgets?: AdminDashboardWidget[];
    };
    nav?: AdminNavDeclaration[];
  };
  contentTypes?: ContentTypeFrontendRegistration[];
  messages?: LocaleMessagesMap;
  pluginId: P;
  /**
   * Public pages this plugin contributes, declared rather than shipped as a
   * framework's route files.
   *
   * Additive and optional: a plugin with a `src/routes/` tree keeps working
   * exactly as it did, because that tree is still copied into every Next.js app
   * by `scripts/prepare-plugins-files.ts`. This is the parallel path - the one an
   * application that is not Next.js can read - and `buildPluginRouteManifest`
   * turns every plugin's list into the application's route manifest.
   *
   * Nothing in this package renders them yet. See `src/routing/`.
   */
  routes?: PluginRouteDefinition[];
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
