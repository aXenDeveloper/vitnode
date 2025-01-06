import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
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

export class SignOutAuthBody {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;
}

export class SignUpAuthBody {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  @Transform(TransformString)
  email: string;

  @ApiProperty({ example: 'aXen' })
  @Matches(nameRegex)
  @MaxLength(32)
  @MinLength(3)
  @Transform(TransformString)
  name: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  newsletter?: boolean;

  @ApiProperty({ example: 'Test123!' })
  @IsStrongPassword({
    minLength: 8,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}

export class VerifyConfirmEmailAuthQuery {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsNumber()
  @Transform(({ value }) => +value)
  user_id: number;
}

export class SendForgotPasswordAuthBody {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  @Transform(TransformString)
  email: string;
}

export class ChangeForgotPasswordAuthBody {
  @ApiProperty({ example: 'Test123!' })
  @IsStrongPassword({
    minLength: 8,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsNumber()
  user_id: number;
}
