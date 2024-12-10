import { ABSOLUTE_PATHS } from '@/app.module';
import { core_languages } from '@/database/schema/languages';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { rm, unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class DeleteLanguagesAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async delete(id: number): Promise<void> {
    const language =
      await this.databaseService.db.query.core_languages.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        columns: {
          code: true,
          protected: true,
          default: true,
        },
      });

    if (!language) {
      throw new NotFoundException();
    }

    if (language.protected) {
      throw new BadRequestException('PROTECTED_LANGUAGE');
    }

    if (language.default) {
      throw new BadRequestException('DEFAULT_LANGUAGE');
    }

    // Delete language files only in dev mode
    if (this.configService.get('dev_mode')) {
      const plugins = await this.databaseService.db.query.core_plugins.findMany(
        {
          orderBy: (table, { desc }) => desc(table.updated_at),
          columns: {
            code: true,
          },
        },
      );

      await Promise.all(
        [...plugins, { code: 'core' }, { code: 'admin' }].map(async plugin => {
          const path = join(
            ABSOLUTE_PATHS.plugin({ code: plugin.code }).frontend.languages,
            `${language.code}.json`,
          );

          if (!existsSync(path)) return;
          await unlink(path);
        }),
      );
    }

    // Remove assets
    const assetsPath = join(
      ABSOLUTE_PATHS.uploads.public,
      'assets',
      language.code,
    );
    await rm(assetsPath, { recursive: true });

    await this.databaseService.db
      .delete(core_languages)
      .where(eq(core_languages.code, language.code));
  }
}
