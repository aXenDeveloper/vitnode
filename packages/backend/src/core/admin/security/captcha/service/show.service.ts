import { getConfigFile } from '@/helpers/config';
import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import {
  CaptchaSecurityConfig,
  HelpersCaptchaSecurityAdminService,
} from '../helpers.service';

@Injectable()
export class ShowCaptchaSecurityAdminService extends HelpersCaptchaSecurityAdminService {
  async show(): Promise<ShowCaptchaSecurityAdminObj> {
    const config = getConfigFile();

    if (!existsSync(this.path)) {
      return {
        ...config.security.captcha,
        secret_key: '',
      };
    }

    const captchaSecurityConfig: CaptchaSecurityConfig = JSON.parse(
      await readFile(this.path, 'utf8'),
    );

    return {
      ...config.security.captcha,
      ...captchaSecurityConfig,
    };
  }
}
