import { core_files } from '@/database/schema/files';
import { ConfigHelperService } from '@/helpers/config.service';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  EditThemeEditorStylesAdminBody,
  EditThemeEditorStylesAdminObj,
} from 'vitnode-shared/admin/styles/theme-editor.dto';

@Injectable()
export class EditThemeEditorStylesAdminService {
  constructor(
    private readonly filesHelper: FilesHelperService,
    private readonly configHelper: ConfigHelperService,
    private readonly databaseService: InternalDatabaseService,
  ) {}

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
    const config = await this.configHelper.getConfig();

    await Promise.all(
      [
        {
          file: logo_dark,
          name: 'logo_dark' as const,
        },
        {
          file: mobile_logo_dark,
          name: 'mobile_logo_dark' as const,
        },
        {
          file: logo_light,
          name: 'logo_light' as const,
        },
        {
          file: mobile_logo_light,
          name: 'mobile_logo_light' as const,
        },
      ].map(async item => {
        const current = config[item.name];
        if (current && delete_logos.includes(item.name)) {
          await this.filesHelper.delete({
            dir_folder: current.dir_folder,
            file_name: current.file_name,
          });

          await this.databaseService.db
            .delete(core_files)
            .where(
              and(
                eq(core_files.dir_folder, current.dir_folder),
                eq(core_files.file_name, current.file_name),
                eq(core_files.file_size, current.file_size),
                eq(core_files.file_name_original, current.file_name_original),
              ),
            );
        }

        if (item.file) {
          const file = await this.filesHelper.upload({
            file: item.file,
            plugin_code: 'core',
            folder: 'logos',
          });

          const [data] = await this.databaseService.db
            .insert(core_files)
            .values(file)
            .returning();

          await this.configHelper.updateConfig({
            [item.name]: data.id,
          });
        }
      }),
    );

    await this.configHelper.updateConfig({
      logo_text: text,
      logo_width: width,
      logo_mobile_width: mobile_width,
    });

    const updatedConfig = await this.configHelper.getConfig();

    return {
      logos: {
        width: updatedConfig.logo_width,
        mobile_width: updatedConfig.logo_mobile_width,
        text: updatedConfig.logo_text,
        logo_dark: updatedConfig.logo_dark,
        logo_light: updatedConfig.logo_light,
        mobile_logo_dark: updatedConfig.mobile_logo_dark,
        mobile_logo_light: updatedConfig.mobile_logo_light,
      },
    };
  }
}
