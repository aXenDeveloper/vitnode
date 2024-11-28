import { ApiProperty, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { TransformString } from '../utils/text-language';
import { nameRegex, SignInAuthObj } from './auth.dto';

export class RegisterSSOCallbackAuthBody extends PickType(SSOCallbackAuthObj, [
  'provider_id',
  'access_token',
] as const) {
  @ApiProperty({ example: 'aXen' })
  @Matches(nameRegex)
  @MaxLength(32)
  @MinLength(3)
  @Transform(TransformString)
  name: string;
}

export class SSOCallbackAuthObj extends SignInAuthObj {
  @ApiProperty()
  @IsString()
  access_token: string;

  @ApiProperty()
  @IsString()
  provider: string;

  @ApiProperty()
  @IsString()
  provider_id: string;
}

export class SSOUrlAuthObj {
  @ApiProperty()
  url: string;
}
