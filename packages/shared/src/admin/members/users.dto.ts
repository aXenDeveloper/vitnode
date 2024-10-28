import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { User } from '../../user.dto';
import {
  PageInfoObj,
  PaginationQuery,
  SortByPaginationBody,
} from '../../utils/pagination.dto';
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
