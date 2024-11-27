import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { DeleteNavPluginsAdminBody } from 'vitnode-shared/admin/plugins/nav.dto';

@Injectable()
export class DeleteNavPluginsAdminService {
  async delete({
    plugin_code,
    code,
    body: { parent_code },
  }: {
    body: DeleteNavPluginsAdminBody;
    code: string;
    plugin_code: string;
  }): Promise<void> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).config;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }
    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    // Update config
    if (parent_code) {
      const parent = config.nav.find(nav => nav.code === parent_code);

      if (!parent) {
        throw new NotFoundException('PARENT_NOT_FOUND');
      }

      parent.children = (parent.children ?? []).filter(
        child => child.code !== code,
      );
    } else {
      const codeExists = config.nav.find(nav => nav.code === code);
      if (!codeExists) {
        throw new NotFoundException();
      }

      config.nav = config.nav.filter(nav => nav.code !== code);
    }

    await writeFile(pathConfig, JSON.stringify(config, null, 2));
  }
}
