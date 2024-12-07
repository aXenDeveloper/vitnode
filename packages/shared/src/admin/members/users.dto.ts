import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { nameRegex } from '../../auth/auth.dto';
import { User } from '../../user.dto';
import { PaginationObj, PaginationQuery } from '../../utils/pagination.dto';
import { SortDirectionEnum } from '../../utils/pagination.enum';
import { TransformString } from '../../utils/text-language';
import { UsersMembersAdminSortEnum } from './users.enum';

export class EditUserMembersAdminBody {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  @Transform(TransformString)
  email: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  group_id: number;

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
}

export class UserMembersAdmin extends User {
  @ApiProperty()
  email: string;

  @ApiProperty()
  email_verified: boolean;

  @ApiProperty()
  newsletter: boolean;
}

export class UsersMembersAdminObj extends PaginationObj {
  @ApiProperty({ type: [UserMembersAdmin] })
  edges: UserMembersAdmin[];
}

export class UsersMembersAdminQuery extends PaginationQuery {
  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => value.split(','))
  groups?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: UsersMembersAdminSortEnum,
  })
  @IsEnum(UsersMembersAdminSortEnum)
  @IsOptional()
  sortBy?: UsersMembersAdminSortEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}
