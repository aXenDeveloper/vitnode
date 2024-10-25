import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';
import {
  ShowAuthObj,
  SignUpAuthBody,
  VerifyConfirmEmailAuthBody,
} from 'vitnode-shared/auth.dto';

import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';

@ApiTags('Core')
@Controller('core/auth')
export class AuthController {
  constructor(
    private readonly showService: ShowAuthService,
    private readonly signUpService: SignUpAuthService,
    private readonly verifyConfirmEmailService: VerifyConfirmEmailAuthService,
  ) {}

  @Get()
  @ApiResponse({
    status: 200,
    type: ShowAuthObj,
  })
  async show(): Promise<ShowAuthObj> {
    return await this.showService.show();
  }

  @Post('sign_up')
  async signUp(@Req() req: Request, @Body() body: SignUpAuthBody) {
    return await this.signUpService.signUp({ req, body });
  }

  @Get('verify_confirm_email')
  @ApiResponse({
    status: 200,
  })
  async verifyConfirmEmail(
    @Body() body: VerifyConfirmEmailAuthBody,
  ): Promise<string> {
    return await this.verifyConfirmEmailService.verify(body);
  }
}
