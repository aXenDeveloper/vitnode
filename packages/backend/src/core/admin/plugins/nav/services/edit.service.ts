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

@Injectable()
export class EditNavPluginsAdminService {
  async edit({
    previous_code,
    plugin_code,
    body: { code, icon, parent_code, keywords },
  }: {
    body: CreateNavPluginsAdminBody;
    plugin_code: string;
    previous_code: string;
  }): Promise<ParentNavAuthAdminObj> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code: plugin_code,
    }).config;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }
    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    const currentCode = removeSpecialCharacters(code);
    const existsNavCode = config.nav.find(nav => nav.code === currentCode);
    if (existsNavCode && code !== existsNavCode.code) {
      throw new ConflictException('CODE_ALREADY_EXISTS');
    }

    if (parent_code) {
      const parent = config.nav.find(nav => nav.code === parent_code);

      if (!parent) {
        throw new NotFoundException('PARENT_NOT_FOUND');
      }

      // Build new children nav
      const children = parent.children ?? [];
      const navIndex = children.findIndex(nav => nav.code === previous_code);

      children[navIndex] = {
        code: currentCode,
        icon,
        keywords,
      };
    } else {
      const navIndex = config.nav.findIndex(nav => nav.code === previous_code);
      config.nav[navIndex] = {
        code: currentCode,
        icon,
        keywords,
        children: config.nav[navIndex]?.children,
      };
    }

    await writeFile(pathConfig, JSON.stringify(config, null, 2));

    return {
      code: currentCode,
      icon,
      keywords,
    };
  }
}
