import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

@ApiTags('Core')
@Controller('core/auth/sso')
export class SSOAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly ssoHelper: SSOAuthHelper,
  ) {}

  @Get(':provider/callback')
  async callbackSSO(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
  ) {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');

    const body = {
      client_id: '',
      client_secret: '',
      code: query.code,
      grant_type: 'authorization_code',
      redirect_uri: `${frontendUrl}/login/sso/google/callback`,
    };

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const tokenData: {
      access_token?: string;
    } = await res.json();
    if (!tokenData.access_token) {
      throw new ForbiddenException('Invalid token');
    }

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const userInfo = await userInfoResponse.json();

    return 'callback';
  }

  @Get(':provider')
  getUrlSSO(@Param('provider') provider: string): SSOUrlAuthObj {
    return this.ssoHelper.getSSO(provider).getUrl();
  }
}
