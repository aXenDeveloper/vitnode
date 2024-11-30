import { ABSOLUTE_PATHS } from '@/app.module';
import { configPath, ConfigType, getConfigFile } from '@/helpers/config';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings/main.dto';
import { ManifestWithLang } from 'vitnode-shared/manifest.dto';

import { getManifest, ManifestType } from '../../metadata/helpers';

@Injectable()
export class EditMainSettingsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  protected async updateDescription({
    languages,
    site_description,
    site_name,
    site_short_name,
  }: {
    languages: { code: string }[];
    site_description: MainSettingsAdminBody['site_description'];
    site_name: MainSettingsAdminBody['site_name'];
    site_short_name: MainSettingsAdminBody['site_short_name'];
  }) {
    const update = await Promise.all(
      (site_description ?? []).map(async el => {
        const item =
          el.value !== undefined
            ? el
            : site_description?.find(el => el.language_code === 'en')?.value
              ? site_description.find(el => el.language_code === 'en')
              : site_description?.find(el => el.value);

        // Still not found?
        if (!item) {
          throw new InternalServerErrorException();
        }

        const manifest = await getManifest({ lang_code: item.language_code });
        const newData: ManifestType = {
          ...manifest,
          lang: el.language_code,
          description: item.value,
          name: site_name,
          short_name: site_short_name,
        };

        await writeFile(
          join(
            ABSOLUTE_PATHS.uploads.public,
            'assets',
            item.language_code,
            'manifest.webmanifest',
          ),
          JSON.stringify(newData, null, 2),
          'utf8',
        );

        return el.language_code;
      }),
    );

    // Update rest of the languages
    await Promise.all(
      languages
        .filter(item => !update.includes(item.code))
        .map(async item => {
          const value =
            site_description?.find(el => el.language_code === 'en')?.value ??
            site_description?.[0]?.value ??
            '';

          const path = join(
            ABSOLUTE_PATHS.uploads.public,
            'assets',
            item.code,
            'manifest.webmanifest',
          );
          const manifest: ManifestWithLang = JSON.parse(
            await readFile(path, 'utf8'),
          );
          const newData: ManifestWithLang = {
            ...manifest,
            description: value,
          };

          await writeFile(path, JSON.stringify(newData, null, 2), 'utf8');
        }),
    );
  }

  async edit({
    site_description,
    site_name,
    site_short_name,
    contact_email,
  }: MainSettingsAdminBody): Promise<MainSettingsAdminBody> {
    const config = getConfigFile();
    const newData: ConfigType = {
      ...config,
      settings: {
        ...config.settings,
        main: {
          ...config.settings.main,
          site_name,
          site_short_name,
          contact_email,
        },
      },
    };
    await writeFile(configPath, JSON.stringify(newData, null, 2), 'utf8');
    const languages =
      await this.databaseService.db.query.core_languages.findMany({
        columns: {
          code: true,
        },
      });

    await this.updateDescription({
      languages,
      site_description,
      site_name,
      site_short_name,
    });

    return {
      site_description,
      site_name,
      site_short_name,
      contact_email,
    };
  }
}
