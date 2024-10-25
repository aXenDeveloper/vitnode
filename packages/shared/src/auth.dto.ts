import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { TransformString } from './utils/text-language';

export const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export class ShowAuthObj {
  @ApiProperty()
  plugin_code_default: string;
}

export class SignUpAuthBody {
  @Transform(TransformString)
  @IsEmail()
  @ApiProperty({ example: 'test@test.com' })
  email: string;

  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(32)
  @Matches(nameRegex)
  @ApiProperty({ example: 'aXen' })
  name: string;

  @ApiPropertyOptional({ example: false })
  newsletter?: boolean;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @ApiProperty({ example: 'Test123!' })
  password: string;
}

export class VerifyConfirmEmailAuthBody {
  @ApiProperty()
  token: string;

  @ApiProperty()
  user_id: number;
}
