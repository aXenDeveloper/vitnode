import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable } from '@nestjs/common';
import { join } from 'path';

export interface CaptchaSecurityConfig {
  secret_key: string;
}

@Injectable()
export class HelpersCaptchaSecurityAdminService {
  protected readonly path: string = join(
    ABSOLUTE_PATHS.plugin({ code: 'core' }).root,
    'utils',
    'captcha.config.json',
  );
}
