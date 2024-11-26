import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { User, UserWithDangerousInfo } from '../user.dto';
import { TransformString } from '../utils/text-language';

export const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export class ShowAuthObj {
  @ApiPropertyOptional()
  user: null | UserWithDangerousInfo;
}

export class SignAuthObj extends OmitType(User, ['group'] as const) {}

export class SignOutAuthBody {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;
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
  @IsBoolean()
  @IsOptional()
  newsletter?: boolean;

  @IsStrongPassword({
    minLength: 8,
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

export class SignInAuthBody {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  admin?: boolean;

  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Test123!' })
  @IsString()
  password: string;
}

export class SignInAuthObj extends SignAuthObj {
  @ApiProperty()
  login_token: string;
}
