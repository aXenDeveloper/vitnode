import { ApiProperty } from '@nestjs/swagger';

export class NewUsersStats {
  @ApiProperty()
  count: number;

  @ApiProperty()
  date: Date;
}

export class ShowDashboardAdminObj {
  @ApiProperty({ type: [NewUsersStats] })
  new_users: NewUsersStats[];
}
