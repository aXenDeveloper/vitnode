import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConfigHelperService } from '../config.service';
import { EmailHelpersServiceType } from './email-helpers.type';
import EmailTemplate from './template/email-template';

@Injectable()
export class EmailHelpersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  getHelpersForEmail = async () => {
    const config = await this.configHelper.getConfig();
    const frontend_url: string = this.configService.getOrThrow('frontend_url');
    const backend_url: string = this.configService.getOrThrow('backend_url');

    return {
      site_name: config.site_name,
      site_short_name: config.site_short_name,
      logo: config.email_logo,
      frontend_url,
      backend_url,
      contact_email: config.contact_email,
      color_primary: config.email_color_primary,
      color_primary_foreground: config.email_color_primary_foreground,
    };
  };

  template: EmailHelpersServiceType['template'] = async props => {
    return EmailTemplate({
      ...props,
      helpers: await this.getHelpersForEmail(),
    });
  };
}
