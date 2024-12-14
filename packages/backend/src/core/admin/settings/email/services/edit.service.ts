import { core_files } from '@/database/schema/files';
import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  EditEmailSettingsAdminBody,
  ShowEmailSettingsAdminObj,
} from 'vitnode-shared/admin/settings/email.dto';

@Injectable()
export class EditEmailSettingsAdminService {
  constructor(
    private readonly mailService: EmailHelperService,
    private readonly filesService: FilesHelperService,
    private readonly configHelpers: ConfigHelperService,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async edit({
    body: { color_primary, color_primary_foreground, delete_logo },
    files: { logo },
  }: {
    body: Omit<EditEmailSettingsAdminBody, 'logo'>;
    files: Pick<EditEmailSettingsAdminBody, 'logo'>;
  }): Promise<ShowEmailSettingsAdminObj> {
    const isEmailEnabled = this.mailService.checkIfEnable();
    const config = await this.configHelpers.getConfig();

    // Update email settings
    const updatedEmailSettings = {
      color_primary,
      color_primary_foreground,
      logo: config.email_logo,
    };

    // Handle logo deletion
    if (
      (delete_logo || logo) &&
      config.email_logo &&
      config.email_logo_file_id
    ) {
      await this.filesService.delete({
        dir_folder: config.email_logo.dir_folder,
        file_name: config.email_logo.file_name,
      });

      await Promise.all([
        this.databaseService.db
          .delete(core_files)
          .where(eq(core_files.id, config.email_logo_file_id)),
        this.configHelpers.cleanCache(),
      ]);
    }

    // Handle logo upload
    if (logo) {
      const file = await this.filesService.upload({
        file: logo,
        folder: 'settings',
        plugin_code: 'core',
      });

      const [fileFromDb] = await this.databaseService.db
        .insert(core_files)
        .values(file)
        .returning();

      await this.configHelpers.updateConfig({
        email_logo_file_id: fileFromDb.id,
      });
    }

    return {
      color_primary,
      is_enabled: isEmailEnabled,
      logo: updatedEmailSettings.logo,
    };
  }
}
