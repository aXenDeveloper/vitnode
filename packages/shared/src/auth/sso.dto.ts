import { ApiProperty, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { TransformString } from '../utils/text-language';
import { nameRegex, SignInAuthObj } from './auth.dto';

export class SSOUrlAuthObj {
  @ApiProperty()
  url: string;
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

export class RegisterSSOCallbackAuthBody extends PickType(SSOCallbackAuthObj, [
  'provider_id',
  'access_token',
] as const) {
  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(32)
  @Matches(nameRegex)
  @ApiProperty({ example: 'aXen' })
  name: string;
}
