import { ABSOLUTE_PATHS } from '@/app.module';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { User } from 'vitnode-shared/user.dto';

import { coreNav } from './core.nav';

@Injectable()
export class NavAuthAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async nav({ user }: { user: User }): Promise<ShowAuthAdminObj['nav']> {
    const permissions: {
      groups: { id: string; permissions?: string[] }[];
      plugin_code: string;
    }[] = await this.userHelper.getUserAdminPermission({
      user,
    });

    const adminNavPlugins =
      await this.databaseService.db.query.core_plugins.findMany({
        orderBy: (table, { asc }) => asc(table.created_at),
        columns: {
          code: true,
        },
      });

    const navFromPlugins = await Promise.all(
      adminNavPlugins.map(async ({ code }) => {
        const pathConfig = ABSOLUTE_PATHS.plugin({ code }).config;
        if (!existsSync(pathConfig)) {
          return {
            code,
            nav: [],
          };
        }

        const config: ConfigPlugin = JSON.parse(
          await readFile(pathConfig, 'utf8'),
        );

        return {
          code,
          nav: config.nav,
        };
      }),
    );

    const nav: ShowAuthAdminObj['nav'] = [...coreNav, ...navFromPlugins]
      .filter(plugin => (plugin.nav ?? []).length > 0)
      .map(plugin => ({
        ...plugin,
        nav: (plugin.nav ?? []).map(nav => ({
          ...nav,
          keywords: nav.keywords ?? [],
          children: (nav.children ?? []).map(child => ({
            ...child,
            keywords: child.keywords ?? [],
          })),
        })),
      }));

    if (permissions.length === 0) return nav;

    // Create a map for quick lookup of permissions by plugin code
    const permissionMap = new Map(
      permissions.map(permission => [permission.plugin_code, permission]),
    );

    // Filter nav to include only plugins present in permissions
    const pluginsInPermissions = nav.filter(plugin =>
      permissionMap.has(plugin.code),
    );

    // Map over the filtered plugins to process their nav items
    const filterGroups: ShowAuthAdminObj['nav'] = pluginsInPermissions.map(
      plugin => {
        const pluginPermission = permissionMap.get(plugin.code);
        if (!pluginPermission) return plugin;

        // Create a map of group IDs to group objects with a Set of permissions
        const groupMap = new Map();
        pluginPermission.groups.forEach(group => {
          groupMap.set(group.id, {
            ...group,
            permissionSet: new Set(group.permissions),
          });
        });

        // Filter the nav items based on the permissions
        const filteredNav = (plugin.nav ?? []).filter(navItem => {
          return (
            groupMap.has(navItem.code) ||
            groupMap.has(`can_manage_${navItem.code}`) ||
            navItem.code === 'dashboard'
          );
        });

        // Map over filteredNav to process each navItem
        const processedNav = filteredNav.map(navItem => {
          const group =
            groupMap.get(navItem.code) ||
            groupMap.get(`can_manage_${navItem.code}`);

          if (!group) {
            return { ...navItem, permissions: [] };
          }

          // If group.permissions is empty, return navItem as is
          if (group.permissions.length === 0) {
            return navItem;
          }

          // Filter navItem's children based on group.permissions
          const filteredChildren = navItem.children?.filter(child =>
            group.permissionSet.has(`can_manage_${group.id}_${child.code}`),
          );

          return {
            ...navItem,
            children: filteredChildren,
          };
        });

        return {
          ...plugin,
          nav: processedNav,
        };
      },
    );

    return filterGroups.filter(plugin => (plugin.nav ?? []).length > 0);
  }
}
