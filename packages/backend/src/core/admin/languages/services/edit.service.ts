import { core_languages } from '@/database/schema/languages';
import { configPath, ConfigType, getConfigFile } from '@/helpers/config';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { writeFile } from 'fs/promises';
import {
  EditLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

@Injectable()
export class EditLanguagesAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async edit({
    body,
    id,
  }: {
    body: EditLanguagesAdminBody;
    id: number;
  }): Promise<LanguagesAdminObj> {
    const language =
      await this.databaseService.db.query.core_languages.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        columns: {
          code: true,
        },
      });

    if (!language) {
      throw new NotFoundException();
    }

    // Update config file
    const config: ConfigType = getConfigFile();
    if (body.default) {
      config.langs.forEach(lang => {
        lang.default = false;
      });
    }

    config.langs = config.langs.map(lang => {
      if (lang.code === language.code) {
        return { ...lang, ...body };
      }

      return lang;
    });
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Edit default language
    if (body.default) {
      // Disable previous default language
      await this.databaseService.db
        .update(core_languages)
        .set({ default: false })
        .where(eq(core_languages.default, true));
    }

    const [editData] = await this.databaseService.db
      .update(core_languages)
      .set({ ...body, updated_at: new Date() })
      .where(eq(core_languages.id, id))
      .returning();

    return editData;
  }
}
