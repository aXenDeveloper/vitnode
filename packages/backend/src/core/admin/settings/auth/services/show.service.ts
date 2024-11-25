import { getConfigFile } from '@/helpers/config';
import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class ShowAuthSettingsAdminService {
  constructor(private readonly mailHelper: EmailHelperService) {}

  show(): ShowAuthSettingsAdminObj {
    const config = getConfigFile();
    const isEmailEnabled = this.mailHelper.checkIfEnable();

    return {
      force_login: config.settings.authorization.force_login,
      lock_register: config.settings.authorization.lock_register,
      require_confirm_email:
        config.settings.authorization.require_confirm_email && isEmailEnabled,
    };
  }
}
