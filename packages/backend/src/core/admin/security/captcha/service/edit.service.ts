import { configPath, getConfigFile } from '@/helpers/config';
import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import {
  CaptchaSecurityConfig,
  HelpersCaptchaSecurityAdminService,
} from '../helpers.service';

@Injectable()
export class EditCaptchaSecurityAdminService extends HelpersCaptchaSecurityAdminService {
  async edit({
    secret_key,
    ...rest
  }: ShowCaptchaSecurityAdminObj): Promise<ShowCaptchaSecurityAdminObj> {
    const config = getConfigFile();
    const captchaSecurityConfig: CaptchaSecurityConfig = {
      secret_key,
    };
    config.security.captcha = {
      ...rest,
    };

    // Write public config to file
    await writeFile(configPath, JSON.stringify(config, null, 2));
    // Write default config to file
    await writeFile(this.path, JSON.stringify(captchaSecurityConfig, null, 2));

    return {
      ...config.security.captcha,
      ...captchaSecurityConfig,
    };
  }
}
