import {
  FileTextIcon,
  LayoutDashboardIcon,
  ServerIcon,
  ShieldUserIcon,
  UsersRoundIcon,
  WrenchIcon,
} from "lucide-react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import {
  contentEntityKey,
  type ContentLabelTranslator,
  contentNouns,
} from "@/content/admin/labels";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentAdminHref } from "@/content/registry";
import { normalizeNamespaceList } from "@/routing";

/** A resolved sub-item, as the sidebar and the search index read it. */
export interface AdminNavSubItem {
  href: string;
  isOpenInNewTab?: boolean;
  title: string;
}

/** A resolved top-level item, with whatever sub-items survived the filter. */
export interface AdminNavItem extends AdminNavSubItem {
  icon?: React.ReactNode;
  items?: AdminNavSubItem[];
}

export interface NavAdminParent {
  id: string;
  items: AdminNavItem[];
  title: string;
}

export type AdminNavTranslator = ContentLabelTranslator;

export type AdminNavTitle =
  | { contentTypeId: string; kind: "content"; pluginId: string }
  | {
      key: string;
      kind: "key";

      namespace: string;
    };

/** A sub-item as declared: a destination, a permission, an un-translated title. */
export interface AdminNavSubItemDeclaration {
  href: string;
  isOpenInNewTab?: boolean;
  permission?: PermissionsStaffArgs;
  title: AdminNavTitle;
}

/** A top-level declaration, which may carry an icon and sub-items. */
export interface AdminNavItemDeclaration extends AdminNavSubItemDeclaration {
  icon?: React.ReactNode;
  items?: AdminNavSubItemDeclaration[];
}

export type AdminNavConfig = Pick<VitNodeConfig, "plugins">;

/** One sidebar heading and everything declared under it. */
export interface AdminNavGroupDeclaration {
  id: string;
  items: AdminNavItemDeclaration[];
  title: AdminNavTitle;
}

/** One un-translated title, resolved. */
const resolveTitle = (title: AdminNavTitle, t: AdminNavTranslator): string => {
  if (title.kind === "key") return t(title.key);

  // The same resolution the screen's own heading uses, so the sidebar and the
  // page it opens cannot disagree about what the records are called.
  return contentNouns({ id: title.contentTypeId }, title.pluginId, t).title;
};

const isAllowed = (
  permission: PermissionsStaffArgs | undefined,
  set: StaffPermissionSet,
): boolean => !permission || hasStaffPermission(set, permission);

export const filterNavItems = (
  items: AdminNavItemDeclaration[],
  set: StaffPermissionSet,
  t: AdminNavTranslator,
): AdminNavItem[] => {
  const result: AdminNavItem[] = [];

  for (const item of items) {
    if (!isAllowed(item.permission, set)) continue;

    if (item.items && item.items.length > 0) {
      const visibleSubItems = item.items.filter(subItem =>
        isAllowed(subItem.permission, set),
      );
      if (visibleSubItems.length === 0) continue;

      result.push({
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        title: resolveTitle(item.title, t),
        items: visibleSubItems.map(subItem => ({
          href: subItem.href,
          isOpenInNewTab: subItem.isOpenInNewTab,
          title: resolveTitle(subItem.title, t),
        })),
      });
    } else {
      result.push({
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        title: resolveTitle(item.title, t),
      });
    }
  }

  return result;
};

const key = (value: string, namespace = "admin.global"): AdminNavTitle => ({
  key: value,
  kind: "key",
  namespace,
});

/** A core permission tuple, which is every tuple in the group below. */
const core = (
  module: string,
  permission = "can_view",
): PermissionsStaffArgs => ({
  module,
  permission,
  plugin: CONFIG_PLUGIN.pluginId,
});

/** Core's own group, before the permission filter. */
const coreNavGroup = (): AdminNavGroupDeclaration => ({
  id: "core",
  title: key("admin.global.nav.core"),
  items: [
    {
      href: "/admin/core/",
      icon: <LayoutDashboardIcon />,
      title: key("admin.global.nav.dashboard"),
    },
    {
      href: "/admin/core/system",
      title: key("admin.global.nav.system.title"),
      icon: <ServerIcon />,
      items: [
        {
          title: key("admin.global.nav.system.integrations"),
          href: "/admin/core/system/integrations",
          permission: core("system"),
        },
        {
          title: key("admin.global.nav.system.files"),
          href: "/admin/core/system/files",
          permission: core("files"),
        },
      ],
    },
    {
      href: "/admin/core/users",
      title: key("admin.global.nav.users.title"),
      icon: <UsersRoundIcon />,
      items: [
        {
          title: key("admin.global.nav.users.list"),
          href: "/admin/core/users",
          permission: core("users"),
        },
        {
          title: key("admin.global.nav.users.roles"),
          href: "/admin/core/users/roles",
          permission: core("roles"),
        },
      ],
    },
    {
      href: "/admin/core/staff",
      title: key("admin.global.nav.staff.title"),
      icon: <ShieldUserIcon />,
      items: [
        {
          title: key("admin.global.nav.staff.moderators"),
          href: "/admin/core/staff/moderators",
          permission: core("staff_moderators"),
        },
        {
          title: key("admin.global.nav.staff.admins"),
          href: "/admin/core/staff/admins",
          permission: core("staff_admins"),
        },
      ],
    },
    {
      href: "/admin/core/advanced",
      title: key("admin.global.nav.advanced.title"),
      icon: <WrenchIcon />,
      items: [
        {
          title: key("admin.global.nav.advanced.search"),
          href: "/admin/core/advanced/search",
          permission: core("system"),
        },
        {
          title: key("admin.global.nav.advanced.cron"),
          href: "/admin/core/advanced/cron",
          permission: core("cron"),
        },
        {
          title: key("admin.global.nav.advanced.queue"),
          href: "/admin/core/advanced/queue",
          permission: core("queue"),
        },
      ],
    },
  ],
});

const contentNavItems = (
  plugin: VitNodeConfig["plugins"][number],
): AdminNavItemDeclaration[] =>
  (plugin.contentTypes ?? [])
    .filter(({ definition }) => definition.admin.navigation.enabled)
    .map(({ definition, icon }) => ({
      href: contentAdminHref(definition),
      icon: icon ?? <FileTextIcon />,
      permission: {
        module: definition.permissionModule,
        permission: CONTENT_PERMISSIONS.view,
        plugin: plugin.pluginId,
      },
      title: {
        contentTypeId: definition.id,
        kind: "content" as const,
        pluginId: plugin.pluginId,
      },
    }));

const declaredNavItems = (
  plugin: VitNodeConfig["plugins"][number],
): AdminNavItemDeclaration[] =>
  (plugin.admin?.nav ?? []).map(item => ({
    href: item.href,
    icon: item.icon,
    isOpenInNewTab: item.isOpenInNewTab,
    title: key(
      `${plugin.pluginId}.admin.nav.${item.id}`,
      `${plugin.pluginId}.admin.nav`,
    ),
    permission: item.permission
      ? { plugin: plugin.pluginId, ...item.permission }
      : undefined,
    items:
      item.items?.map(subItem => ({
        href: subItem.href,
        isOpenInNewTab: subItem.isOpenInNewTab,
        title: key(
          `${plugin.pluginId}.admin.nav.${item.id}.${subItem.id}`,
          `${plugin.pluginId}.admin.nav`,
        ),
        permission: subItem.permission
          ? { plugin: plugin.pluginId, ...subItem.permission }
          : undefined,
      })) ?? [],
  }));

/**
 * The whole AdminCP navigation as *declarations*: core, then one group per
 * installed plugin, with nothing translated and nothing filtered.
 *
 * The first of the model's two stages, and the split is what lets them run in
 * different places. This one is a pure function of `VitNodeConfig` - it needs no
 * request, no session and no locale - so a host may run it wherever the plugin
 * registry actually lives. In the Next.js AdminCP that is the same render pass
 * as everything else; in a TanStack Start host the plugin registry is
 * deliberately kept out of the browser bundle (see `vitnode.shell.config.ts`),
 * so a host with plugins to declare runs this where its config is and hands the
 * result to the shell.
 *
 * The second stage - {@link filterNavItems} - is the one that needs an admin and
 * a language, and it is the only one that does.
 */
export const adminNavDeclarations = (
  vitNodeConfig: AdminNavConfig,
): AdminNavGroupDeclaration[] => [
  coreNavGroup(),
  ...vitNodeConfig.plugins.map(plugin => ({
    id: plugin.pluginId,
    // The namespace is the key itself - a leaf. `pickMessages` copies a leaf as
    // readily as a branch, and asking for `@vitnode/blog` instead would ship
    // every string that plugin has in order to render one heading.
    title: key(`${plugin.pluginId}.title`, `${plugin.pluginId}.title`),
    items: [...contentNavItems(plugin), ...declaredNavItems(plugin)],
  })),
];

/**
 * The namespace one title's string is loaded from.
 *
 * Two rules, one per shape of {@link AdminNavTitle}, and both of them are
 * *stated* rather than guessed. A key carries its own namespace, because nothing
 * about the string `@vitnode/blog.admin.nav.reports` says where the namespace
 * ends and the key continues. A content noun does not need to, because its
 * lookup is `contentI18nKeys`' - `{pluginId}.content.{entity}.title` and
 * `.label` - and the branch holding both is exactly what a screen already loads
 * for that content type.
 */
const titleNamespace = (title: AdminNavTitle): string =>
  title.kind === "key"
    ? title.namespace
    : `${title.pluginId}.content.${contentEntityKey(title.contentTypeId)}`;

/**
 * Every message namespace a set of declarations needs, and not one more.
 *
 * The AdminCP shell mounts one message provider above the whole panel, and that
 * provider has to name every namespace anything it renders reads from -
 * `core.global` and `admin.global` for the chrome, plus whatever the navigation
 * itself resolves. Before Stage 12 wired plugin navigation in, the second half
 * was empty and the question did not arise; a sidebar with a plugin group in it
 * that loads only the shell's two namespaces renders that group's headings as
 * dotted identifiers.
 *
 * The alternative - load every plugin's whole message tree - is what the
 * namespace mechanism exists to avoid: the merged catalogue holds every screen's
 * copy for every plugin, and shipping all of it to draw a list of links is a
 * screen's worth of strings per screen nobody is looking at. So this walks the
 * declarations and asks each title where *its* string is, which is the smallest
 * set that renders them.
 *
 * De-duplicated and sorted by `normalizeNamespaceList`, the same normalisation a
 * plugin route's namespaces go through, so two callers with the same navigation
 * ask for one cache entry rather than two holding identical bytes.
 *
 * Note the budget: `MAX_NAMESPACES` caps a single request at 16, which is the
 * shell's two plus roughly three per plugin that contributes navigation - a
 * heading, its content types and its declared entries. An installation large
 * enough to exceed that wants a coarser projection, and it will be told so
 * rather than quietly served half a sidebar.
 */
export const adminNavNamespaces = (
  declarations: readonly AdminNavGroupDeclaration[],
): string[] =>
  normalizeNamespaceList(
    declarations.flatMap(group => [
      titleNamespace(group.title),
      ...group.items.flatMap(item => [
        titleNamespace(item.title),
        ...(item.items ?? []).map(subItem => titleNamespace(subItem.title)),
      ]),
    ]),
  );

/**
 * The navigation a shell is handed: what to render, and what to render it with.
 *
 * One value rather than two arguments that have to agree. The declarations and
 * the namespaces are derived from the same walk, so a host cannot pass a sidebar
 * with a plugin group in it and forget the strings that group needs - which is a
 * failure that shows up as a working panel full of dotted identifiers rather
 * than as an error.
 */
export interface AdminNavBundle {
  declarations: AdminNavGroupDeclaration[];
  namespaces: string[];
}

/**
 * Declarations and their namespaces, from configured plugins.
 *
 * Stage one of the model, packaged for a host: pure, config-only, no admin and
 * no language, so it runs wherever a host's plugin data actually lives - which
 * in a TanStack Start application is a generated browser-safe projection rather
 * than the full plugin registry. See `AdminNavPluginSource` in `lib/plugin`.
 */
export const adminNavBundle = (
  vitNodeConfig: AdminNavConfig,
): AdminNavBundle => {
  const declarations = adminNavDeclarations(vitNodeConfig);

  return { declarations, namespaces: adminNavNamespaces(declarations) };
};

/**
 * Declarations plus an admin plus a language, as the navigation to render.
 *
 * Groups with nothing visible in them are dropped rather than rendered empty - a
 * plugin whose every screen this admin lacks permission for should not leave a
 * heading behind.
 */
export const resolveAdminNav = ({
  declarations,
  permissions,
  t,
}: {
  declarations: AdminNavGroupDeclaration[];
  permissions: StaffPermissionSet;
  t: AdminNavTranslator;
}): NavAdminParent[] =>
  declarations
    .map(group => ({
      id: group.id,
      items: filterNavItems(group.items, permissions, t),
      title: resolveTitle(group.title, t),
    }))
    .filter(group => group.items.length > 0);

/**
 * The whole AdminCP navigation, both stages, for a caller that has the config to
 * hand.
 *
 * What the Next.js `getAdminNav` calls, and what a TanStack host calls when its
 * plugin registry is reachable from wherever the sidebar is built. A host that
 * has to split the two stages calls them separately instead.
 */
export const buildAdminNav = ({
  permissions,
  t,
  vitNodeConfig,
}: {
  permissions: StaffPermissionSet;
  t: AdminNavTranslator;
  vitNodeConfig: VitNodeConfig;
}): NavAdminParent[] =>
  resolveAdminNav({
    declarations: adminNavDeclarations(vitNodeConfig),
    permissions,
    t,
  });
