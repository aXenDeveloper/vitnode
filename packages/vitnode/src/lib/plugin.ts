import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemAutoFormComponentProps } from "../components/form/auto-form";
import type {
  AnyContentTypeDefinition,
  ContentSelect,
  ContentSystemField,
} from "../content/types";
import type { PluginRoutes } from "../routing/tree";
import type { AdminNavItem as ResolvedAdminNavItem } from "../views/admin/layouts/sidebar/nav/nav-model";
import type { LocaleMessagesMap } from "./i18n/types";

export type AdminNavPermission = Omit<PermissionsStaffArgs, "plugin">;

interface AdminNavItem extends Pick<
  ResolvedAdminNavItem,
  "href" | "icon" | "isOpenInNewTab"
> {
  id: string;
  permission?: AdminNavPermission;
}

export type AdminNavDeclaration = AdminNavItem & {
  items?: Omit<AdminNavItem, "icon">[];
};

/** A content type, as much of it as the sidebar reads: what it is, and its icon. */
export type AdminNavContentType = Pick<
  ContentTypeFrontendRegistration,
  "definition" | "icon"
>;

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

  forms?: ContentTypeFormsRegistration;
  /** Sidebar icon. Defaults to a generic document icon. */
  icon?: React.ReactNode;
}

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

  routes?: PluginRoutes;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
