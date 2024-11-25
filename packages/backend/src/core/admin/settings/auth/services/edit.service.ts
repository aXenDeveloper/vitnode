import { configPath, getConfigFile } from '@/helpers/config';
import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class EditAuthSettingsAdminService {
  constructor(private readonly mailHelper: EmailHelperService) {}

  async edit(
    args: ShowAuthSettingsAdminObj,
  ): Promise<ShowAuthSettingsAdminObj> {
    const isEmailEnabled = this.mailHelper.checkIfEnable();
    const config = getConfigFile();
    config.settings.authorization = args;
    await writeFile(configPath, JSON.stringify(config, null, 2));

    return {
      force_login: args.force_login,
      lock_register: args.lock_register,
      require_confirm_email:
        config.settings.authorization.require_confirm_email && isEmailEnabled,
    };
  }
}
