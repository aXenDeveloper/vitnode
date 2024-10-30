import { getConfigFile } from '@/helpers/config';
import { EmailService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { ShowEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

@Injectable()
export class ShowEmailSettingsAdminService {
  constructor(private readonly mailService: EmailService) {}

  show(): ShowEmailSettingsAdminObj {
    const {
      settings: { email: emailSettings },
    } = getConfigFile();

    return {
      ...emailSettings,
      is_enabled: this.mailService.checkIfEnable(),
    };
  }
}
