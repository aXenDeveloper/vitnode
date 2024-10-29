import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
import {
  PageInfoObj,
  PaginationQuery,
  SortByPaginationBody,
} from '../../utils/pagination.dto';
import { TransformString } from '../../utils/text-language';
import { ColumnsSortDirectionEnum } from './users.enum';

class SortedByUsersMembersAdminBody extends SortByPaginationBody {
  @ApiPropertyOptional({
    enum: ColumnsSortDirectionEnum,
    name: 'ColumnsSortDirectionEnum',
  })
  @IsEnum(ColumnsSortDirectionEnum)
  @IsOptional()
  column?: ColumnsSortDirectionEnum;
}

export class UsersMembersAdminQuery extends PaginationQuery {
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  groups?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: SortedByUsersMembersAdminBody;
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
