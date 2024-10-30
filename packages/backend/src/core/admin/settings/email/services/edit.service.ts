import { getConfigFile } from '@/helpers/config';
import { EmailService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import {
  EditEmailSettingsAdminBody,
  ShowEmailSettingsAdminObj,
} from 'vitnode-shared/admin/settings/email.dto';

@Injectable()
export class EditEmailSettingsAdminService {
  constructor(private readonly mailService: EmailService) {}

  async edit(
    body: EditEmailSettingsAdminBody,
  ): Promise<ShowEmailSettingsAdminObj> {
    const {
      settings: { email: emailSettings },
    } = getConfigFile();

    return {
      ...emailSettings,
      is_enabled: this.mailService.checkIfEnable(),
    };
  }
}
