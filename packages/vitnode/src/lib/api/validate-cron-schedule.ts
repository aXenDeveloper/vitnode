/**
 * Validates a cron schedule expression
 * Supports standard cron format: minute hour day month weekday
 * Also supports extended format with seconds (6 fields): second minute hour day month weekday
 *
 * @param schedule - The cron schedule string to validate
 * @returns true if the schedule is valid, false otherwise
 *
 * @example
 * ```typescript
 * validateCronSchedule("0 0 * * *") // true - runs at midnight every day
 * validateCronSchedule("*\/5 * * * *") // true - runs every 5 minutes
 * validateCronSchedule("0 0 1 * *") // true - runs at midnight on the first day of each month
 * validateCronSchedule("invalid") // false
 * ```
 */
export function validateCronSchedule(schedule: string): boolean {
  if (!schedule || typeof schedule !== "string") {
    return false;
  }

  const trimmedSchedule = schedule.trim();
  if (!trimmedSchedule) {
    return false;
  }

  const parts = trimmedSchedule.split(/\s+/);

  // Support both 5-field (minute hour day month weekday) and 6-field (second minute hour day month weekday) formats
  if (parts.length !== 5 && parts.length !== 6) {
    return false;
  }

  // Define field configurations
  const fieldConfigs =
    parts.length === 6
      ? [
          { name: "second", min: 0, max: 59 },
          { name: "minute", min: 0, max: 59 },
          { name: "hour", min: 0, max: 23 },
          { name: "day", min: 1, max: 31 },
          { name: "month", min: 1, max: 12 },
          { name: "weekday", min: 0, max: 7 }, // 0 and 7 both represent Sunday
        ]
      : [
          { name: "minute", min: 0, max: 59 },
          { name: "hour", min: 0, max: 23 },
          { name: "day", min: 1, max: 31 },
          { name: "month", min: 1, max: 12 },
          { name: "weekday", min: 0, max: 7 }, // 0 and 7 both represent Sunday
        ];

  // Validate each field
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const config = fieldConfigs[i];

    if (!validateCronField(part, config.min, config.max)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a single cron field
 * Supports: asterisk, numbers, ranges (1-5), steps (star/5, 1-10/2), and lists (1,2,3)
 */
function validateCronField(field: string, min: number, max: number): boolean {
  if (field === "*") {
    return true;
  }

  // Handle lists (e.g., "1,2,3,5")
  if (field.includes(",")) {
    const listItems = field.split(",");

    return listItems.every(item => validateCronField(item.trim(), min, max));
  }

  // Handle steps (e.g., "*/5" or "1-10/2")
  if (field.includes("/")) {
    const [range, step] = field.split("/");
    const stepNum = parseInt(step, 10);

    if (isNaN(stepNum) || stepNum <= 0 || stepNum > max) {
      return false;
    }

    // If range is "*", it's valid
    if (range === "*") {
      return true;
    }

    // Otherwise, validate the range part
    return validateCronField(range, min, max);
  }

  // Handle ranges (e.g., "1-5")
  if (field.includes("-")) {
    const [start, end] = field.split("-");
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (
      isNaN(startNum) ||
      isNaN(endNum) ||
      startNum < min ||
      startNum > max ||
      endNum < min ||
      endNum > max ||
      startNum > endNum
    ) {
      return false;
    }

    return true;
  }

  // Handle single numbers
  const num = parseInt(field, 10);
  if (isNaN(num) || num < min || num > max) {
    return false;
  }

  return true;
}
