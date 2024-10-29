import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { nameRegex } from '../../auth.dto';
import { User } from '../../user.dto';
import { PageInfoObj, PaginationQuery } from '../../utils/pagination.dto';
import { SortDirectionEnum } from '../../utils/pagination.enum';
import { TransformString } from '../../utils/text-language';
import { ColumnsSortUsersMembersAdminEnum } from './users.enum';

export class UsersMembersAdminQuery extends PaginationQuery {
  @ApiPropertyOptional({ type: [Number] })
  @Transform(({ value }) => value.split(','))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ColumnsSortUsersMembersAdminEnum,
    name: 'ColumnsSortUsersMembersAdminEnum',
  })
  @IsEnum(ColumnsSortUsersMembersAdminEnum)
  @IsOptional()
  sortBy?: ColumnsSortUsersMembersAdminEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum, name: 'SortDirectionEnum' })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}

export class UserMembersAdmin extends User {
  @ApiProperty()
  email: string;

  @ApiProperty()
  email_verified: boolean;

  @ApiProperty()
  joined_at: Date;

  @ApiProperty()
  newsletter: boolean;
}

export class UsersMembersAdminObj extends PageInfoObj {
  @ApiProperty({ type: [UserMembersAdmin] })
  edges: UserMembersAdmin[];
}

export class EditUserMembersAdminBody {
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
}
