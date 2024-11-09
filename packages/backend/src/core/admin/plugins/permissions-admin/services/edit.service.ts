import { ABSOLUTE_PATHS } from '@/app.module';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { CreatePermissionsAdminPluginsAdminBody } from 'vitnode-shared/admin/plugins/permissions-admin.dto';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

@Injectable()
export class EditPermissionsAdminPluginsAdminService {
  async edit({
    body: { parent_id, id },
    plugin_code,
    old_id,
  }: {
    body: CreatePermissionsAdminPluginsAdminBody;
    old_id: string;
    plugin_code: string;
  }): Promise<PermissionsStaff> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).config;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }

    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    const parent = config.permissions_admin?.find(
      permission => permission.id === parent_id,
    );

    if (!parent && parent_id) {
      throw new NotFoundException();
    }

    // Check if the id already exists
    if (old_id !== id) {
      const existsPermission = parent
        ? parent.permissions.find(child => child === id)
        : config.permissions_admin?.find(permission => permission.id === id);

      if (existsPermission) {
        throw new ConflictException('PERMISSION_ALREADY_EXISTS');
      }
    }

    const oldPermission = parent
      ? parent.permissions.find(child => child === old_id)
      : config.permissions_admin?.find(permission => permission.id === old_id);

    if (!oldPermission) {
      throw new NotFoundException('Permission with the old id for the plugin');
    }

    let newConfig: ConfigPlugin;

    if (parent) {
      newConfig = {
        ...config,
        permissions_admin: config.permissions_admin?.map(permission => {
          if (permission.id === parent.id) {
            return {
              ...permission,
              children: permission.permissions.map(child => {
                if (child === old_id) {
                  return id;
                }

                return child;
              }),
            };
          }

          return permission;
        }),
      };
    } else {
      newConfig = {
        ...config,
        permissions_admin: config.permissions_admin?.map(permission => {
          if (permission.id === old_id) {
            return {
              id,
              permissions: permission.permissions,
            };
          }

          return permission;
        }),
      };
    }

    await writeFile(pathConfig, JSON.stringify(newConfig, null, 2));

    const returnValue = parent
      ? newConfig.permissions_admin?.find(
          permission => permission.id === parent.id,
        )
      : newConfig.permissions_admin?.find(permission => permission.id === id);

    if (!returnValue) {
      throw new InternalServerErrorException();
    }

    return {
      id,
      permissions: [],
    };
  }
}
