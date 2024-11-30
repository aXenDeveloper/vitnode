import { configPath, ConfigType, getConfigFile } from '@/helpers/config';
import { EmailHelperService } from '@/helpers/email/email.service';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import {
  EditEmailSettingsAdminBody,
  ShowEmailSettingsAdminObj,
} from 'vitnode-shared/admin/settings/email.dto';

@Injectable()
export class EditEmailSettingsAdminService {
  constructor(
    private readonly mailService: EmailHelperService,
    private readonly filesService: FilesHelperService,
  ) {}

  async edit({
    body: { color_primary, color_primary_foreground, delete_logo },
    files: { logo },
  }: {
    body: Omit<EditEmailSettingsAdminBody, 'logo'>;
    files: Pick<EditEmailSettingsAdminBody, 'logo'>;
  }): Promise<ShowEmailSettingsAdminObj> {
    const isEmailEnabled = this.mailService.checkIfEnable();
    const configSettings = getConfigFile();
    const emailSettings = configSettings.settings.email;

    // Update email settings
    const updatedEmailSettings = {
      ...emailSettings,
      color_primary,
      color_primary_foreground,
      logo: emailSettings.logo,
    };

    // Handle logo deletion
    if ((delete_logo || logo) && emailSettings.logo) {
      await this.filesService.delete({
        dir_folder: emailSettings.logo.dir_folder,
        file_name: emailSettings.logo.file_name,
      });

      updatedEmailSettings.logo = undefined;
    }

    // Handle logo upload
    if (logo) {
      updatedEmailSettings.logo = await this.filesService.upload({
        file: logo,
        folder: 'settings',
        plugin_code: 'core',
      });
    }

    const newConfig: ConfigType = {
      ...configSettings,
      settings: {
        ...configSettings.settings,
        email: updatedEmailSettings,
      },
    };

    await writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');

    return {
      color_primary,
      is_enabled: isEmailEnabled,
      logo: updatedEmailSettings.logo,
    };
  }
}
