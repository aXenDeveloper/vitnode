import type { Request, Response } from 'express';

import { AuthGuard } from '@/guards/auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ShowAuthObj,
  SignAuthObj,
  SignInAuthBody,
  SignInAuthObj,
  SignOutAuthBody,
  SignUpAuthBody,
  VerifyConfirmEmailAuthBody,
} from 'vitnode-shared/auth.dto';

import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { SignInAuthService } from './services/sign_in.service';
import { SignOutAuthService } from './services/sign_out.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';

@ApiTags('Core')
@Controller('core/auth')
export class AuthController {
  constructor(
    private readonly showService: ShowAuthService,
    private readonly signUpService: SignUpAuthService,
    private readonly signInService: SignInAuthService,
    private readonly verifyConfirmEmailService: VerifyConfirmEmailAuthService,
    private readonly signOutService: SignOutAuthService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: ShowAuthObj,
  })
  async show(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShowAuthObj> {
    return await this.showService.show({ req, res });
  }

  @Post('sign_in')
  @ApiCreatedResponse({
    type: SignInAuthObj,
  })
  async signIn(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignInAuthBody,
  ): Promise<SignInAuthObj> {
    return await this.signInService.singIn({ req, res, body });
  }

  @Delete('sign_out')
  @ApiSecurity('')
  @ApiOkResponse()
  @UseGuards(AuthGuard)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignOutAuthBody,
  ): Promise<void> {
    await this.signOutService.signOut({ req, res, body });
  }

  @Post('sign_up')
  @ApiCreatedResponse({
    type: SignAuthObj,
  })
  async signUp(
    @Req() req: Request,
    @Body() body: SignUpAuthBody,
  ): Promise<SignAuthObj> {
    return await this.signUpService.signUp({ req, body });
  }

  @Get('verify_confirm_email')
  @ApiOkResponse()
  async verifyConfirmEmail(
    @Body() body: VerifyConfirmEmailAuthBody,
  ): Promise<void> {
    await this.verifyConfirmEmailService.verify(body);
  }
}
