import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';

@Injectable()
export class ShowNavPluginsAdminService {
  async show(code: string): Promise<ParentNavAuthAdminObj[]> {
    const pathConfig = ABSOLUTE_PATHS.plugin({
      code,
    }).metadata;
    if (!existsSync(pathConfig)) {
      throw new NotFoundException();
    }

    const config: ConfigPlugin = JSON.parse(await readFile(pathConfig, 'utf8'));

    return (config.nav ?? []).map(nav => {
      return {
        ...nav,
        keywords: nav.keywords,
      };
    });
  }
}
