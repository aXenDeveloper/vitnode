import { ABSOLUTE_PATHS } from '@/app.module';
import { core_plugins } from '@/database/schema/plugins';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
    body,
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

    const [updatePlugin] = await this.databaseService.db
      .update(core_plugins)
      .set(body)
      .where(eq(core_plugins.code, code))
      .returning();

    // Update config.json
    const path = ABSOLUTE_PATHS.plugin({ code }).config;
    const config: Omit<ConfigPlugin, 'version_code' | 'versions'> = JSON.parse(
      await readFile(path, 'utf8'),
    );

    config.name = body.name;
    config.description = body.description;
    config.author = body.author;
    config.author_url = body.author_url;
    config.support_url = body.support_url;

    await writeFile(path, JSON.stringify(config, null, 2));

    return updatePlugin;
  }
}
