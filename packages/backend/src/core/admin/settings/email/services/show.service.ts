import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { ShowEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

@Injectable()
export class ShowEmailSettingsAdminService {
  constructor(
    private readonly mailService: EmailHelperService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async show(): Promise<ShowEmailSettingsAdminObj> {
    const config = await this.configHelper.getConfig();

    return {
      color_primary: config.email_color_primary,
      logo: config.email_logo,
      is_enabled: this.mailService.checkIfEnable(),
    };
  }
}
