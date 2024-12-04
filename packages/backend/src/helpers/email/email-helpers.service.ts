import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getConfigFile } from '../config';
import { EmailHelpersServiceType } from './email-helpers.type';
import EmailTemplate from './template/email-template';

@Injectable()
export class EmailHelpersService {
  constructor(private readonly configService: ConfigService) {}

  getHelpersForEmail: EmailHelpersServiceType['getHelpersForEmail'] = () => {
    const config = getConfigFile();
    const frontend_url: string = this.configService.getOrThrow('frontend_url');
    const backend_url: string = this.configService.getOrThrow('backend_url');

    return {
      site_name: config.settings.main.site_name,
      site_short_name: config.settings.main.site_short_name,
      logo: config.settings.email.logo,
      frontend_url,
      backend_url,
      contact_email: config.settings.main.contact_email,
    };
  };

  template: EmailHelpersServiceType['template'] = props => {
    return EmailTemplate({ ...props, helpers: this.getHelpersForEmail() });
  };
}
