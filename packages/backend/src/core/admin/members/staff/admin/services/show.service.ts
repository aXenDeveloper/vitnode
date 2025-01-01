import { ABSOLUTE_PATHS } from '@/app.module';
import { core_admin_permissions } from '@/database/schema/admins';
import { core_groups } from '@/database/schema/groups';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import {
  AdminStaffMembersAdminObj,
  AdminStaffMembersAdminQuery,
} from 'vitnode-shared/admin/members/staff/admin.dto';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { PermissionsStaffObj } from 'vitnode-shared/admin/staff.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

import { coreAdminPermissions } from '../helpers/core-admin-permissions';

@Injectable()
export class ShowAdminStaffMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
    private readonly userHelper: UserHelper,
  ) {}

  private async getPermissions() {
    const plugins = await this.databaseService.db.query.core_plugins.findMany();

    const permissionsFromPlugins: PermissionsStaffObj[] = plugins.map(
      plugin => {
        const pathConfig = ABSOLUTE_PATHS.plugin({
          code: plugin.code,
        }).config;
        if (!existsSync(pathConfig)) {
          return {
            plugin_code: plugin.code,
            plugin: plugin.name,
            groups: [],
          };
        }

        const config: ConfigPlugin = JSON.parse(
          readFileSync(pathConfig, 'utf8'),
        );

        return {
          plugin_code: plugin.code,
          plugin: plugin.name,
          groups: (config.permissions_admin ?? []).map(item => ({
            ...item,
            permissions: item.permissions ?? [],
          })),
        };
      },
    );

    return [...coreAdminPermissions, ...permissionsFromPlugins];
  }

  async show({
    first,
    last,
    cursor,
    sortBy,
    sortDirection,
  }: AdminStaffMembersAdminQuery): Promise<AdminStaffMembersAdminObj> {
    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_admin_permissions,
      first,
      last,
      sortBy,
      sortDirection,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'updated_at',
      },
      query: async args =>
        await this.databaseService.db.query.core_admin_permissions.findMany({
          ...args,
          with: {
            group: {
              columns: {
                id: true,
                color: true,
              },
            },
          },
        }),
    });

    const edges = await Promise.all(
      pagination.edges.map(async edge => {
        if (edge.user_id) {
          const user = await this.userHelper.getUserById({
            id: edge.user_id,
          });

          if (!user) {
            throw new InternalServerErrorException('User not found');
          }

          return {
            ...edge,
            user_or_group: {
              ...user,
            },
            permissions: edge.data?.permissions ?? [],
          };
        }

        if (!edge.group) {
          throw new InternalServerErrorException('Group not found');
        }

        const group_name = await this.stringLanguageHelper.get({
          database: core_groups,
          item_ids: [edge.group.id],
          plugin_code: 'core',
          variables: ['name'],
        });

        return {
          ...edge,
          user_or_group: {
            ...edge.group,
            group_name,
          },
          permissions: edge.data?.permissions ?? [],
        };
      }),
    );

    return {
      ...pagination,
      edges,
      permissions: await this.getPermissions(),
    };
  }
}
