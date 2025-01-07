import { ABSOLUTE_PATHS } from '@/app.module';
import { core_files_using } from '@/database/schema/files';
import { core_languages_words } from '@/database/schema/languages';
import { core_plugins } from '@/database/schema/plugins';
import { ConfigHelperService } from '@/helpers/config.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';

import { ChangeFilesPluginsAdminHelpersService } from '../helpers/change-files.service';

@Injectable()
export class DeletePluginsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly changeFilesHelper: ChangeFilesPluginsAdminHelpersService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  protected async deleteFolderWhenExists(path: string) {
    if (existsSync(path)) {
      await rm(path, { recursive: true });
    }
  }

  async delete(id: number): Promise<void> {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        code: true,
      },
    });

    if (!plugin) {
      throw new NotFoundException();
    }

    const [pluginCount] = await this.databaseService.db
      .select({
        count: count(),
      })
      .from(core_plugins);

    if (pluginCount.count === 1) {
      throw new BadRequestException('Cannot delete the last plugin');
    }

    await this.changeFilesHelper.changeFiles({
      code: plugin.code,
      action: 'delete',
    });
    const pluginPaths = ABSOLUTE_PATHS.plugin({ code: plugin.code });
    await this.deleteFolderWhenExists(pluginPaths.root);

    // Frontend
    const frontendPaths = [
      'pages',
      'pages_main',
      'admin_pages',
      'admin_pages_auth',
      'plugin',
    ] as const;
    await Promise.all(
      frontendPaths.map(async path => {
        await this.deleteFolderWhenExists(pluginPaths.frontend[path]);
      }),
    );

    // Shared
    await this.deleteFolderWhenExists(pluginPaths.shared);

    // Uploads
    await this.deleteFolderWhenExists(
      join(ABSOLUTE_PATHS.uploads.public, plugin.code),
    );

    await Promise.all([
      this.databaseService.db
        .delete(core_plugins)
        .where(eq(core_plugins.code, plugin.code)),
      this.databaseService.db
        .delete(core_languages_words)
        .where(eq(core_languages_words.plugin_code, plugin.code)),
      this.databaseService.db
        .delete(core_files_using)
        .where(eq(core_files_using.plugin, plugin.code)),
      this.configHelper.updateConfig({
        restart_server: true,
      }),
    ]);
  }
}
