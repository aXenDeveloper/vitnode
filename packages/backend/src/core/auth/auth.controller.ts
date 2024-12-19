import type { Request, Response } from 'express';

import { AuthGuard } from '@/guards/auth.guard';
import { Controllers } from '@/helpers/controller.decorator';
import {
  Body,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import {
  ShowAuthObj,
  SignAuthObj,
  SignInAuthBody,
  SignInAuthObj,
  SignOutAuthBody,
  SignUpAuthBody,
  VerifyConfirmEmailAuthQuery,
} from 'vitnode-shared/auth/auth.dto';

import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { SignInAuthService } from './services/sign_in/sign_in.service';
import { SignOutAuthService } from './services/sign_out.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth',
})
export class AuthController {
  constructor(
    private readonly showService: ShowAuthService,
    private readonly signUpService: SignUpAuthService,
    private readonly signInService: SignInAuthService,
    private readonly verifyConfirmEmailService: VerifyConfirmEmailAuthService,
    private readonly signOutService: SignOutAuthService,
  ) {}

  @ApiOkResponse({
    type: ShowAuthObj,
    description: 'Show auth',
  })
  @Get()
  async show(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShowAuthObj> {
    return await this.showService.show({ req, res });
  }

  @ApiCreatedResponse({
    type: SignInAuthObj,
    description: 'Sign in user',
  })
  @Post('sign_in')
  async signIn(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignInAuthBody,
  ): Promise<SignInAuthObj> {
    return await this.signInService.singIn({ req, res, body });
  }

  @ApiOkResponse({
    description: 'Sign out user',
  })
  @ApiSecurity('')
  @Delete('sign_out')
  @UseGuards(AuthGuard)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: SignOutAuthBody,
  ): Promise<void> {
    await this.signOutService.signOut({ req, res, body });
  }

  @ApiCreatedResponse({
    type: SignAuthObj,
    description: 'Sign up user',
  })
  @Post('sign_up')
  async signUp(
    @Req() req: Request,
    @Body() body: SignUpAuthBody,
  ): Promise<SignAuthObj> {
    return await this.signUpService.signUp({ req, body });
  }

  @ApiOkResponse({
    description: 'Verify confirm email',
  })
  @Get('verify_confirm_email')
  async verifyConfirmEmail(
    @Query() query: VerifyConfirmEmailAuthQuery,
  ): Promise<void> {
    await this.verifyConfirmEmailService.verify(query);
  }
}
