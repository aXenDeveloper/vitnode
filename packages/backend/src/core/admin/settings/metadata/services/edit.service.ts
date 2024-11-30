import { ABSOLUTE_PATHS } from '@/app.module';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';

import { getManifest, ManifestType } from '../helpers';

@Injectable()
export class EditMetadataAdminService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: InternalDatabaseService,
    private readonly filesHelper: FilesHelperService,
  ) {}

  private async processIcon(icon: ShowMetadataAdminBody['icon']) {
    if (!icon) return;
    const resolutions = [512, 192, 144, 96, 72, 48, 36];

    return await Promise.all(
      resolutions.map(async resolution => {
        const file = await sharp(Buffer.from(icon.buffer))
          .resize(resolution, resolution, {
            fit: 'contain',
            kernel: 'lanczos3',
            withoutEnlargement: true,
          })
          .png({ quality: 100, compressionLevel: 9 })
          .toBuffer();
        const fileSize = (await sharp(file).metadata()).size;
        if (!fileSize) {
          throw new InternalServerErrorException('File size not found');
        }

        const newFile: ShowMetadataAdminBody['icon'] = {
          ...icon,
          buffer: file,
          originalname: icon.originalname.replace(
            '.png',
            `-${resolution}x${resolution}.png`,
          ),
          size: fileSize,
        };

        const uploadObj = await this.filesHelper.upload({
          file: newFile,
          folder: 'manifest',
          plugin_code: 'core',
        });

        return {
          ...uploadObj,
          resolution,
        };
      }),
    );
  }

  async edit({
    body: { remove_icon, ...body },
    files,
  }: {
    body: Omit<ShowMetadataAdminBody, 'icon'>;
    files: Pick<ShowMetadataAdminBody, 'icon'>;
  }): Promise<ShowMetadataAdminObj> {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const backendUrl: string = this.configService.getOrThrow('backend_url');
    const langs = await this.databaseService.db.query.core_languages.findMany({
      columns: {
        code: true,
      },
      orderBy: (table, { desc }) => desc(table.default),
    });

    if (remove_icon || files.icon) {
      const manifest = await getManifest({
        lang_code: 'en',
      });

      if (manifest.icons) {
        await Promise.all(
          manifest.icons.map(async icon => {
            await this.filesHelper.delete({
              dir_folder: icon.dir_folder,
              file_name: icon.file_name,
            });
          }),
        );
      }
    }

    const images = await this.processIcon(files.icon);

    const updateManifests = await Promise.all(
      langs.map(async ({ code }) => {
        const manifest = await getManifest({
          lang_code: code,
        });

        const dataToUpdate: Omit<ManifestType, 'name' | 'short_name'> = {
          ...manifest,
          background_color: body.background_color,
          start_url: `${frontendUrl}/${code}${body.start_url}`,
          theme_color: body.theme_color,
          display: body.display,
          id: `${frontendUrl}/${code}${body.start_url}`,
          lang: code,
        };

        if (remove_icon) {
          dataToUpdate.icons = [];
        } else {
          dataToUpdate.icons = images
            ? images.map(image => ({
                sizes: `${image.resolution}x${image.resolution}`,
                src: `${backendUrl}/public/${image.dir_folder}/${image.file_name}`,
                type: 'image/png',
                ...image,
              }))
            : manifest.icons;
        }

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
