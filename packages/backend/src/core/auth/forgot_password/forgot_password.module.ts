import { Module } from '@nestjs/common';

import { ForgotPasswordAuthController } from './forgot_password.controller';
import { ChangeForgotPasswordAuthService } from './services/change.service';
import { SendForgotPasswordAuthService } from './services/send.service';
import { VerifyForgotPasswordAuthService } from './verify.service';

@Module({
  providers: [
    SendForgotPasswordAuthService,
    VerifyForgotPasswordAuthService,
    ChangeForgotPasswordAuthService,
  ],
  controllers: [ForgotPasswordAuthController],
})
export class ForgotPasswordAuthModule {}
