import { ABSOLUTE_PATHS } from '@/app.module';
import { core_plugins } from '@/database/schema/plugins';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, ne } from 'drizzle-orm';
import { readFile, writeFile } from 'fs/promises';
import {
  ConfigPlugin,
  EditPluginsAdminBody,
} from 'vitnode-shared/admin/plugin.dto';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

@Injectable()
export class EditPluginsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async edit({
    code,
    body: { default: isDefault = false, ...rest },
  }: {
    body: EditPluginsAdminBody;
    code: string;
  }): Promise<ShowPluginAdmin> {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (!plugin) {
      throw new NotFoundException();
    }

    if (code !== plugin.code) {
      throw new BadRequestException('PLUGIN_CODE_MISMATCH');
    }

    if (isDefault) {
      if (!plugin.enabled) {
        throw new BadRequestException('PLUGIN_NOT_ENABLED');
      }

      // Set all other plugins to default: false
      await this.databaseService.db
        .update(core_plugins)
        .set({
          default: false,
        })
        .where(ne(core_plugins.code, code));
    }

    const [updatePlugin] = await this.databaseService.db
      .update(core_plugins)
      .set({
        ...rest,
        default: isDefault,
      })
      .where(eq(core_plugins.code, code))
      .returning();

    // Update metadata.json
    const path = ABSOLUTE_PATHS.plugin({ code }).metadata;
    const config: Omit<ConfigPlugin, 'version_code' | 'versions'> = JSON.parse(
      await readFile(path, 'utf8'),
    );

    config.name = rest.name;
    config.description = rest.description;
    config.author = rest.author;
    config.author_url = rest.author_url;
    config.support_url = rest.support_url;

    await writeFile(path, JSON.stringify(config, null, 2));

    return updatePlugin;
  }
}
