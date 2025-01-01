import { Injectable } from '@nestjs/common';
import { ShowMetadataAdminObj } from 'vitnode-shared/admin/settings/metadata.dto';

import { getManifest } from '../helpers';

@Injectable()
export class ShowMetadataAdminService {
  async show(): Promise<ShowMetadataAdminObj> {
    const manifest = await getManifest({ lang_code: 'en' });
    const icon = manifest.icons?.[0];

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
          }
        : undefined,
    };
  }
}
