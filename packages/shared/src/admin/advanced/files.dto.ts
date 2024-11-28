import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { ShowFile } from '../../files.dto';
import { User } from '../../user.dto';
import { PaginationObj, PaginationQuery } from '../../utils/pagination.dto';

export class ShowFilesAdvancedAdmin extends ShowFile {
  @ApiProperty()
  user: null | User;
}

export class ShowFilesAdvancedAdminObj extends PaginationObj {
  @ApiProperty({ type: [ShowFilesAdvancedAdmin] })
  edges: ShowFilesAdvancedAdmin[];
}

export class ShowFilesAdvancedAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
