import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemAutoFormComponentProps } from "../components/form/auto-form";
import type {
  AnyContentTypeDefinition,
  ContentSelect,
  ContentSystemField,
} from "../content/types";
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
  icon?: React.ReactNode;
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
    nav?: (AdminNavItem & {
      items?: Omit<AdminNavItem, "icon">[];
    })[];
  };
  contentTypes?: ContentTypeFrontendRegistration[];
  messages?: LocaleMessagesMap;
  pluginId: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
