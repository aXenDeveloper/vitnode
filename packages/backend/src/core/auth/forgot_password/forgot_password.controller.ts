import type { Request } from 'express';

import { Controllers } from '@/helpers/controller.decorator';
import { Body, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { SendForgotPasswordAuthBody } from 'vitnode-shared/auth/auth.dto';

import { SendForgotPasswordAuthService } from './services/send.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth/forgot_password',
})
export class ForgotPasswordAuthController {
  constructor(private readonly sendService: SendForgotPasswordAuthService) {}

  @ApiCreatedResponse({ description: 'Send forgot password email' })
  @Post('send')
  async send(@Req() req: Request, @Body() body: SendForgotPasswordAuthBody) {
    return this.sendService.send({ req, body });
  }
}
