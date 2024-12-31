import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ShowCronAdvancedAdminObj } from 'vitnode-shared/admin/advanced/cron.dto';

@Injectable()
export class ShowCronAdvancedAdminService {
  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  show(): ShowCronAdvancedAdminObj {
    const jobs = this.schedulerRegistry.getCronJobs();

    const edges: ShowCronAdvancedAdminObj['edges'] = Array.from(jobs).map(
      ([key, value]) => {
        return {
          name: key,
          running: value.running,
          next_date: value.nextDate().toJSDate(),
          last_execution: value.lastExecution,
          schedule: value.cronTime.source.toString(),
        };
      },
    );

    // Sort by next_date descending
    const sortedEdges = edges.sort(
      (a, b) => b.next_date.getTime() - a.next_date.getTime(),
    );

    return { edges: sortedEdges };
  }
}
