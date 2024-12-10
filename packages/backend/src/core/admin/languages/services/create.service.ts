import { ABSOLUTE_PATHS } from '@/app.module';
import { core_languages } from '@/database/schema/languages';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { cp } from 'fs/promises';
import { join } from 'path';
import {
  CreateLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

@Injectable()
export class CreateLanguagesAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly configService: ConfigService,
  ) {}

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
        if (existsSync(path)) {
          return;
        }

        // Throw error if language file not found in production
        if (!this.configService.get('dev_mode')) {
          throw new NotFoundException(
            `CANNOT_FIND_LANGUAGE_FILE_IN_PLUGIN:${plugin.code}`,
          );
        }

        await cp(join(pathToPluginLang, 'en.json'), path, {
          recursive: true,
        });
      }),
    );
  }

  async create({
    code,
    name,
    time_24,
    timezone,
    allow_in_input,
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
        allow_in_input,
      })
      .returning();

    return newLanguage;
  }
}
