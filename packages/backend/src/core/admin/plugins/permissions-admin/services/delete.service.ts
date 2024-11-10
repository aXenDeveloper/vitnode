import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { DeletePermissionsAdminPluginsAdminBody } from 'vitnode-shared/admin/plugins/permissions-admin.dto';

@Injectable()
export class DeletePermissionsAdminPluginsAdminService {
  async delete({
    plugin_code,
    id,
    body: { parent_id },
  }: {
    body: DeletePermissionsAdminPluginsAdminBody;
    id: string;
    plugin_code: string;
  }): Promise<void> {
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

    const existsPermission = parent
      ? parent.permissions.find(child => child === id)
      : config.permissions_admin?.find(permission => permission.id === id);

    if (!existsPermission) {
      throw new NotFoundException();
    }

    if (parent) {
      config.permissions_admin = config.permissions_admin?.map(permission => {
        if (permission.id === parent_id) {
          permission.permissions = permission.permissions.filter(
            child => child !== id,
          );
        }

        return permission;
      });
    } else {
      config.permissions_admin = config.permissions_admin?.filter(
        permission => permission.id !== id,
      );
    }

    await writeFile(pathConfig, JSON.stringify(config, null, 2));
  }
}
