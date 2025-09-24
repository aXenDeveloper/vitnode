import cronParser from "cron-parser";

export const getNextCronRunDate = (
  schedule: string,
  lastRun: Date | null,
): Date | null => {
  try {
    const options = {
      currentDate: lastRun ?? new Date(0),
    };

    const interval = cronParser.parse(schedule, options);

    return interval.next().toDate();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `\x1b[34m[VitNode]\x1b[0m \x1b[38;5;208mError parsing schedule for nextRun\x1b[0m: ${schedule}`,
      err,
    );

    return null;
  }
};
