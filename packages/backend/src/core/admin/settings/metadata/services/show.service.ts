import { Injectable } from '@nestjs/common';
import { ShowMetadataAdminObj } from 'vitnode-shared/admin/settings/metadata.dto';

import { HelpersShowMetadataAdminService } from '../helpers.service';

@Injectable()
export class ShowMetadataAdminService {
  constructor(
    private readonly helperService: HelpersShowMetadataAdminService,
  ) {}

  async show(): Promise<ShowMetadataAdminObj> {
    // TODO: Add cache
    const manifest = await this.helperService.getManifest({ lang_code: 'en' });

    return {
      background_color: manifest.background_color,
      start_url: manifest.start_url,
      theme_color: manifest.theme_color,
      display: manifest.display,
      id: manifest.id,
      lang: manifest.lang,
    };
  }
}
