import { Module } from '@nestjs/common';

import { ForgotPasswordAuthController } from './forgot_password.controller';
import { SendForgotPasswordAuthService } from './services/send.service';
import { VerifyForgotPasswordAuthService } from './verify.service';

@Module({
  providers: [SendForgotPasswordAuthService, VerifyForgotPasswordAuthService],
  controllers: [ForgotPasswordAuthController],
})
export class ForgotPasswordAuthModule {}
