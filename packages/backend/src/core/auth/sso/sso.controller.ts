import type { Request, Response } from 'express';

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  RegisterSSOCallbackAuthBody,
  SSOCallbackAuthObj,
  SSOUrlAuthObj,
} from 'vitnode-shared/auth/sso.dto';

import { CallbackSSOAuthService } from './services/callback.service';
import { GetUrlSSOAuthService } from './services/get-url.service';
import { RegisterCallbackSSOAuthService } from './services/register-callback.service';

@ApiTags('Core')
@Controller('core/auth/sso')
export class SSOAuthController {
  constructor(
    private readonly getUrlSSO: GetUrlSSOAuthService,
    private readonly callbackSSO: CallbackSSOAuthService,
    private readonly registerCallbackSSO: RegisterCallbackSSOAuthService,
  ) {}

  @Post(':provider/callback')
  @ApiOkResponse({
    type: SSOCallbackAuthObj,
    description: 'Callback SSO',
  })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SSOCallbackAuthObj> {
    return this.callbackSSO.callbackSSO({ provider, code, req, res });
  }

  @Get(':provider')
  @ApiOkResponse({
    type: SSOUrlAuthObj,
    description: 'Get SSO URL',
  })
  async getUrl(@Param('provider') provider: string): Promise<SSOUrlAuthObj> {
    return this.getUrlSSO.getUrlSSO(provider);
  }

  @Post(':provider/register')
  @ApiOkResponse({
    type: SSOCallbackAuthObj,
    description: 'Register user if not exists',
  })
  async register(
    @Body() body: RegisterSSOCallbackAuthBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('provider') provider: string,
  ): Promise<SSOCallbackAuthObj> {
    return this.registerCallbackSSO.registerCallbackSSO({
      body,
      req,
      res,
      provider,
    });
  }
}
