import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { CaptchaSecurityMiddleware } from '../../middleware.dto';

export class ShowCaptchaSecurityAdminObj extends CaptchaSecurityMiddleware {
  @ApiProperty()
  @IsString()
  secret_key: string;
}
