import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { FileObj } from '../../utils/files.dto';
import { PaginationObj, PaginationQuery } from '../../utils/pagination.dto';
import { SortDirectionEnum } from '../../utils/pagination.enum';
import { ShowFilesSettingsAuthSortEnum } from './files.enum';

export class ShowFilesSettingsAuth extends FileObj {
  @ApiProperty()
  count_uses: number;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional()
  file_alt: null | string;

  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  security_key: null | string;
}

export class ShowFilesSettingsAuthObj extends PaginationObj {
  @ApiProperty({ type: [ShowFilesSettingsAuth] })
  edges: ShowFilesSettingsAuth[];
}

export class ShowFilesSettingsAuthQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ShowFilesSettingsAuthSortEnum,
  })
  @IsEnum(ShowFilesSettingsAuthSortEnum)
  @IsOptional()
  sortBy?: ShowFilesSettingsAuthSortEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}
