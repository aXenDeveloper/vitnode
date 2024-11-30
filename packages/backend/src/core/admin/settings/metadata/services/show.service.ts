import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { ShowMetadataAdminObj } from 'vitnode-shared/admin/settings/metadata.dto';

import { getManifest } from '../helpers';

@Injectable()
export class ShowMetadataAdminService {
  async show(): Promise<ShowMetadataAdminObj> {
    const manifest = await getManifest({ lang_code: 'en' });
    const icon = manifest.icons?.[0];
    const faviconPath = join(
      ABSOLUTE_PATHS.uploads.public,
      'assets',
      'favicon.ico',
    );

    return {
      background_color: manifest.background_color,
      start_url: manifest.start_url,
      theme_color: manifest.theme_color,
      display: manifest.display,
      id: manifest.id,
      lang: manifest.lang,
      icon: icon
        ? {
            file_name: icon.file_name,
            dir_folder: icon.dir_folder,
            extension: icon.extension,
            file_name_original: icon.file_name_original,
            file_size: icon.file_size,
            height: icon.height,
            width: icon.width,
            mimetype: icon.mimetype,
            secure: icon.secure,
          }
        : undefined,
      favicon: existsSync(faviconPath)
        ? {
            file_name: 'favicon.ico',
            dir_folder: 'assets',
            extension: 'ico',
            file_name_original: 'favicon.ico',
            file_size: 3,
            height: null,
            width: null,
            mimetype: 'image/x-icon',
            secure: false,
          }
        : undefined,
    };
  }
}
