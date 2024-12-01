import { configPath, getConfigFile } from '@/helpers/config';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import {
  EditThemeEditorStylesAdminBody,
  EditThemeEditorStylesAdminObj,
} from 'vitnode-shared/admin/styles/theme-editor.dto';

@Injectable()
export class EditThemeEditorStylesAdminService {
  constructor(private readonly filesHelper: FilesHelperService) {}

  async update({
    body: { text, width, mobile_width, delete_logos },
    files: { logo_dark, mobile_logo_dark, logo_light, mobile_logo_light },
  }: {
    body: Omit<
      EditThemeEditorStylesAdminBody,
      'logo_dark' | 'logo_light' | 'mobile_logo_dark' | 'mobile_logo_light'
    >;
    files: Pick<
      EditThemeEditorStylesAdminBody,
      'logo_dark' | 'logo_light' | 'mobile_logo_dark' | 'mobile_logo_light'
    >;
  }): Promise<EditThemeEditorStylesAdminObj> {
    const config = getConfigFile();

    await Promise.all(
      [
        {
          file: logo_dark,
          name: 'logo_dark',
        },
        {
          file: mobile_logo_dark,
          name: 'mobile_logo_dark',
        },
        {
          file: logo_light,
          name: 'logo_light',
        },
        {
          file: mobile_logo_light,
          name: 'mobile_logo_light',
        },
      ].map(async item => {
        if (config.logos[item.name] && delete_logos.includes(item.name)) {
          await this.filesHelper.delete({
            dir_folder: config.logos[item.name].dir_folder,
            file_name: config.logos[item.name].file_name,
          });

          config.logos[item.name] = undefined;
        }

        if (item.file) {
          const upload = await this.filesHelper.upload({
            file: item.file,
            plugin_code: 'core',
            folder: 'logos',
          });
          config.logos[item.name] = upload;
        }
      }),
    );

    config.logos = {
      ...config.logos,
      mobile_width: +mobile_width,
      text,
      width: +width,
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));

    return { logos: config.logos };
  }
}
