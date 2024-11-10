import { Module } from '@nestjs/common';

import { CaptchaSecurityAdminController } from './captcha.controller';
import { EditCaptchaSecurityAdminService } from './service/edit.service';
import { ShowCaptchaSecurityAdminService } from './service/show.service';

@Module({
  providers: [ShowCaptchaSecurityAdminService, EditCaptchaSecurityAdminService],
  controllers: [CaptchaSecurityAdminController],
})
export class CaptchaSecurityAdminModule {}
