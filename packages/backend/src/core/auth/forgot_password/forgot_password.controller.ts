import type { Request } from 'express';

import { Controllers } from '@/helpers/controller.decorator';
import { Body, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  ChangeForgotPasswordAuthBody,
  SendForgotPasswordAuthBody,
} from 'vitnode-shared/auth/auth.dto';

import { ChangeForgotPasswordAuthService } from './services/change.service';
import { SendForgotPasswordAuthService } from './services/send.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth/forgot_password',
})
export class ForgotPasswordAuthController {
  constructor(
    private readonly sendService: SendForgotPasswordAuthService,
    private readonly changeService: ChangeForgotPasswordAuthService,
  ) {}

  @ApiOkResponse({ description: 'Change forgot password' })
  @Post('change')
  async change(@Body() body: ChangeForgotPasswordAuthBody) {
    return this.changeService.change(body);
  }

  @ApiCreatedResponse({ description: 'Send forgot password email' })
  @Post('send')
  async send(@Req() req: Request, @Body() body: SendForgotPasswordAuthBody) {
    return this.sendService.send({ req, body });
  }
}
