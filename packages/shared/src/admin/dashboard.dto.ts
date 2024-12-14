import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class NoteDashboard {
  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty()
  updated_at: Date;
}

export class EditNoteDashboardBody extends OmitType(NoteDashboard, [
  'updated_at',
]) {}

export class NewUsersStats {
  @ApiProperty()
  count: number;

  @ApiProperty()
  date: Date;
}

export class ShowDashboardAdminObj {
  @ApiProperty({ type: [NewUsersStats] })
  new_users: NewUsersStats[];

  @ApiProperty()
  note: NoteDashboard;
}
