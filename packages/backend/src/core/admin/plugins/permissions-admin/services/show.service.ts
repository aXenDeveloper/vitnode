import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

@Injectable()
export class ShowPermissionsAdminPluginsAdminService {
  async show(plugin_code: string): Promise<PermissionsStaff[]> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).config;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }

    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    return config.permissions_admin ?? [];
  }
}
