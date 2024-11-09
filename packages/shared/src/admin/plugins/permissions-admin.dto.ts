import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePermissionsAdminPluginsAdminBody {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parent_id?: string;
}

export class DeletePermissionsAdminPluginsAdminBody extends OmitType(
  CreatePermissionsAdminPluginsAdminBody,
  ['id'],
) {}
