import { ABSOLUTE_PATHS } from '@/app.module';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';

@Injectable()
export class EditMetadataAdminService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async edit(data: ShowMetadataAdminBody): Promise<ShowMetadataAdminObj> {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const langs = await this.databaseService.db.query.core_languages.findMany({
      columns: {
        code: true,
      },
      orderBy: (table, { desc }) => desc(table.default),
    });

    const updateManifests = await Promise.all(
      langs.map(async ({ code }) => {
        const dataToUpdate: ShowMetadataAdminObj = {
          background_color: data.background_color,
          start_url: `${frontendUrl}/${code}${data.start_url}`,
          theme_color: data.theme_color,
          display: data.display,
          id: `${frontendUrl}/${code}${data.start_url}`,
          lang: code,
        };

        await writeFile(
          join(
            ABSOLUTE_PATHS.uploads.public,
            'assets',
            code,
            'manifest.webmanifest',
          ),
          JSON.stringify(dataToUpdate, null, 2),
        );

        return dataToUpdate;
      }),
    );

    const updateManifestEnglish = updateManifests.find(
      data => data.lang === 'en',
    );
    if (!updateManifestEnglish) {
      throw new InternalServerErrorException(
        'Manifest for en language not found',
      );
    }

    return updateManifestEnglish;
  }
}
