import { Module } from '@nestjs/common';

import { ForgotPasswordAuthController } from './forgot_password.controller';
import { ChangeForgotPasswordAuthService } from './services/change.service';
import { ForgotPasswordAuthCron } from './services/clear.cron';
import { SendForgotPasswordAuthService } from './services/send.service';
import { VerifyForgotPasswordAuthService } from './verify.service';

@Module({
  providers: [
    SendForgotPasswordAuthService,
    VerifyForgotPasswordAuthService,
    ChangeForgotPasswordAuthService,
    ForgotPasswordAuthCron,
  ],
  controllers: [ForgotPasswordAuthController],
})
export class ForgotPasswordAuthModule {}
