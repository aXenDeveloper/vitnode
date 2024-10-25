import type { Request, Response } from 'express';

import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ShowAuthObj,
  SignInAuthBody,
  SignInAuthObj,
  SignUpAuthBody,
  VerifyConfirmEmailAuthBody,
} from 'vitnode-shared/auth.dto';

import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { SignInAuthService } from './services/sign_in/sign_in.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';

@ApiTags('Core')
@Controller('core/auth')
export class AuthController {
  constructor(
    private readonly showService: ShowAuthService,
    private readonly signUpService: SignUpAuthService,
    private readonly signInService: SignInAuthService,
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

  @Post('sign_in')
  @ApiResponse({
    status: 201,
    type: SignInAuthObj,
  })
  async signIn(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignInAuthBody,
  ): Promise<SignInAuthObj> {
    return await this.signInService.singIn({ req, res, body });
  }

  @Post('sign_up')
  @ApiResponse({
    status: 201,
  })
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
