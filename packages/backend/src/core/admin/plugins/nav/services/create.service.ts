import { ABSOLUTE_PATHS } from '@/app.module';
import { removeSpecialCharacters } from '@/functions';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { CreateNavPluginsAdminBody } from 'vitnode-shared/admin/plugins/nav.dto';

import { HelpersAdminNavPluginsService } from '../helpers.service';

@Injectable()
export class CreateNavPluginsAdminService extends HelpersAdminNavPluginsService {
  async create({
    plugin_code,
    body: { parent_code, icon, keywords, code },
  }: {
    body: CreateNavPluginsAdminBody;
    plugin_code: string;
  }): Promise<ParentNavAuthAdminObj> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).config;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }
    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    const currentCode = removeSpecialCharacters(code);
    const codeExists = this.findItemByCode({
      items: config.nav,
      code: currentCode,
    });

    if (codeExists) {
      throw new ConflictException('CODE_ALREADY_EXISTS');
    }

    // Update config
    if (parent_code) {
      const parent = config.nav.find(nav => nav.code === parent_code);

      if (!parent) {
        throw new NotFoundException('PARENT_NOT_FOUND');
      }

      parent.children = parent.children ?? [];
      parent.children.push({
        code: currentCode,
        icon,
        keywords,
      });
    } else {
      config.nav.push({
        code: currentCode,
        icon,
        keywords,
      });
    }

    await writeFile(pathConfig, JSON.stringify(config, null, 2));

    return {
      code: currentCode,
      icon,
      keywords,
    };
  }
}
