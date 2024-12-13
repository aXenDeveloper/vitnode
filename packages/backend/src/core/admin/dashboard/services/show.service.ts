import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ShowDashboardAdminObj } from 'vitnode-shared/admin/dashboard.dto';

@Injectable()
export class ShowDashboardAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async getNewUsersStats(): Promise<ShowDashboardAdminObj['new_users']> {
    const data = await this.databaseService.db.execute<{
      joined_at_date: string;
      users_joined_at: number;
    }>(sql`
      SELECT DATE(core_users.joined_at) AS joined_at_date, COUNT(*) AS users_joined_at
      FROM core_users
      WHERE core_users.joined_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY joined_at_date
      ORDER BY joined_at_date ASC;
      `);

    // Generate last 7 days dates
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);

      return date;
    });

    // Generate the response
    const response = last7Days.map(date => {
      const dataForDate = data.rows.find(
        d => new Date(d.joined_at_date).toDateString() === date.toDateString(),
      );

      return {
        date,
        count: Number(dataForDate?.users_joined_at ?? 0),
      };
    });

    return response.reverse();
  }

  async show(): Promise<ShowDashboardAdminObj> {
    return {
      new_users: await this.getNewUsersStats(),
    };
  }
}
