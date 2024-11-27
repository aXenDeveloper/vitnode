import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
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

    // Delete lang from json
    const langPathFolder = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).frontend.languages;
    const langs = await readdir(langPathFolder);
    await Promise.all(
      langs.map(async lang => {
        const langFilePath = join(langPathFolder, lang);
        if (!langFilePath.endsWith('.json')) return;

        const langFile = JSON.parse(await readFile(langFilePath, 'utf8'));
        const langCode = parent_code ? `${parent_code}_${code}` : code;

        if (langFile[`admin_${plugin_code}`]?.nav?.[langCode]) {
          delete langFile[`admin_${plugin_code}`].nav[langCode];

          await writeFile(langFilePath, JSON.stringify(langFile, null, 2));
        }
      }),
    );

    await writeFile(pathConfig, JSON.stringify(config, null, 2));
  }
}
