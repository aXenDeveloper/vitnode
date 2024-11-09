import { ABSOLUTE_PATHS } from '@/app.module';
import {
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
export class CreatePermissionsAdminPluginsAdminService {
  async create({
    body: { parent_id, id },
    plugin_code,
  }: {
    body: CreatePermissionsAdminPluginsAdminBody;
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

    let newConfig: ConfigPlugin;
    if (parent) {
      newConfig = {
        ...config,
        permissions_admin: (config.permissions_admin ?? []).map(permission => {
          if (permission.id === parent.id) {
            return {
              ...permission,
              permissions: [...permission.permissions, id],
            };
          }

          return permission;
        }),
      };
    } else {
      newConfig = {
        ...config,
        permissions_admin: [
          ...(config.permissions_admin ?? []),
          {
            id,
            permissions: [],
          },
        ],
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

    return returnValue;
  }
}
