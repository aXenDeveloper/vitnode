import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class EditAuthSettingsAdminService {
  constructor(
    private readonly mailHelper: EmailHelperService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async edit(
    args: ShowAuthSettingsAdminObj,
  ): Promise<ShowAuthSettingsAdminObj> {
    const isEmailEnabled = this.mailHelper.checkIfEnable();
    const config = await this.configHelper.updateConfig({
      auth_force_login: args.force_login,
      auth_lock_register: args.lock_register,
      auth_require_confirm_email: args.require_confirm_email && isEmailEnabled,
    });

    return {
      force_login: args.force_login,
      lock_register: args.lock_register,
      require_confirm_email:
        config.auth_require_confirm_email && isEmailEnabled,
    };
  }
}
