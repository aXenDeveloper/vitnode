/** What is left until a moment, split into whole units. */
export interface CountdownParts {
  days: number;
  /** `true` once the moment has passed. */
  done: boolean;
  hours: number;
  minutes: number;
  seconds: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The time from `nowMs` to `targetMs`, rounded down to the second. */
export const countdownParts = (
  targetMs: number,
  nowMs: number,
): CountdownParts => {
  const left = Math.max(0, targetMs - nowMs);

  return {
    days: Math.floor(left / DAY),
    done: left < SECOND,
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
  };
};
