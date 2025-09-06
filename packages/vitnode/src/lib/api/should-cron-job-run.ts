import cronParser from "cron-parser";

export const shouldCronJobRun = (
  schedule: string,
  lastRun: Date | null,
): boolean => {
  try {
    const now = new Date();
    const options = {
      currentDate: lastRun || new Date(0),
    };

    const interval = cronParser.parse(schedule, options);
    const nextScheduledRun = interval.next().toDate();

    return nextScheduledRun <= now;
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: needed for cron job monitoring
    console.error(
      `\x1b[34m[VitNode]\x1b[0m \x1b[38;5;208mError parsing schedule\x1b[0m: ${schedule}`,
      err,
    );
    return false;
  }
};
