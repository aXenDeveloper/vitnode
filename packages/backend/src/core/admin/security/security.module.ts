import { Module } from '@nestjs/common';

import { CaptchaSecurityAdminModule } from './captcha/captcha.module';

@Module({
  imports: [CaptchaSecurityAdminModule],
})
export class SecurityAdminModule {}
