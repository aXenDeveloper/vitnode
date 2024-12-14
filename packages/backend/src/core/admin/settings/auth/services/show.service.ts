import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class ShowAuthSettingsAdminService {
  constructor(
    private readonly mailHelper: EmailHelperService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async show(): Promise<ShowAuthSettingsAdminObj> {
    const config = await this.configHelper.getConfig();
    const isEmailEnabled = this.mailHelper.checkIfEnable();

    return {
      force_login: config.auth_force_login,
      lock_register: config.auth_lock_register,
      require_confirm_email:
        config.auth_require_confirm_email && isEmailEnabled,
    };
  }
}
