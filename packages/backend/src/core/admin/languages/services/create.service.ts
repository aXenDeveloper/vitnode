import { ABSOLUTE_PATHS } from '@/app.module';
import { core_languages } from '@/database/schema/languages';
import { configPath, ConfigType, getConfigFile } from '@/helpers/config';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { cp, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  CreateLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

@Injectable()
export class CreateLanguagesAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  private async cloneLangInPlugins(pluginCode: string) {
    const plugins = await this.databaseService.db.query.core_plugins.findMany({
      orderBy: (table, { desc }) => desc(table.updated_at),
      columns: {
        code: true,
      },
    });

    await Promise.all(
      [...plugins, { code: 'core' }, { code: 'admin' }].map(async plugin => {
        const pathToPluginLang = ABSOLUTE_PATHS.plugin({ code: plugin.code })
          .frontend.languages;

        const path = join(pathToPluginLang, `${pluginCode}.json`);
        if (existsSync(path)) return;

        await cp(join(pathToPluginLang, 'en.json'), path, { recursive: true });
      }),
    );
  }

  async create({
    code,
    locale,
    name,
    time_24,
    timezone,
  }: CreateLanguagesAdminBody): Promise<LanguagesAdminObj> {
    const defaultLanguage =
      await this.databaseService.db.query.core_languages.findFirst({
        where: (table, { eq }) => eq(table.code, 'en'),
        columns: {
          code: true,
        },
      });

    if (!defaultLanguage) {
      throw new InternalServerErrorException('Default language not found');
    }

    const language =
      await this.databaseService.db.query.core_languages.findFirst({
        where: (table, { eq }) => eq(table.code, code),
      });

    if (language) {
      throw new ConflictException('LANGUAGE_ALREADY_EXISTS');
    }

    await this.cloneLangInPlugins(code);

    // Clone JSON for manifest
    await cp(
      join(
        ABSOLUTE_PATHS.uploads.public,
        'assets',
        'en',
        'manifest.webmanifest',
      ),
      join(
        ABSOLUTE_PATHS.uploads.public,
        'assets',
        code,
        'manifest.webmanifest',
      ),
    );

    // Update config file
    const config: ConfigType = getConfigFile();
    config.langs.push({
      code,
      enabled: true,
      default: false,
    });
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    const [newLanguage] = await this.databaseService.db
      .insert(core_languages)
      .values({
        code,
        name,
        timezone,
        default: false,
        protected: false,
        enabled: true,
        time_24,
        locale,
      })
      .returning();

    return newLanguage;
  }
}
