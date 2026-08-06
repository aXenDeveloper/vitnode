import type {
  CONTENT_SCHEDULE_ACTIONS,
  CONTENT_SCHEDULE_CODES,
  CONTENT_SCHEDULE_STATUSES,
} from "./const";

import { CONTENT_SCHEDULE_PAST_TOLERANCE_MS } from "./const";

export type ContentScheduleAction = (typeof CONTENT_SCHEDULE_ACTIONS)[number];

export type ContentScheduleStatus = (typeof CONTENT_SCHEDULE_STATUSES)[number];

export type ContentScheduleCode =
  (typeof CONTENT_SCHEDULE_CODES)[keyof typeof CONTENT_SCHEDULE_CODES];

/** One schedule, as the AdminCP and the API both see it. */
export interface ContentSchedule {
  action: ContentScheduleAction;
  /** Display name of the person who asked for it, when it is resolvable. */
  actorName: null | string;
  completedAt: Date | null | string;
  createdAt: Date | string;
  createdBy: null | number;
  id: number;
  lastError: null | string;
  scheduledFor: Date | string;
  status: ContentScheduleStatus;
}

export interface ContentScheduleTimingInput {
  action: ContentScheduleAction;
  now: Date;
  /** The pending schedules already on this record, of any action. */
  pending: { action: ContentScheduleAction; scheduledFor: Date | string }[];
  scheduledFor: Date;
}

/**
 * Whether a requested schedule makes sense, and why not when it does not.
 *
 * Pure, and shared by the client and the server on purpose: the dialog can
 * refuse an impossible date before the round trip, and the route stays the
 * authority - both from one function, so they cannot drift into disagreeing.
 */
export const contentScheduleTimingError = ({
  action,
  now,
  pending,
  scheduledFor,
}: ContentScheduleTimingInput): ContentScheduleCode | null => {
  if (Number.isNaN(scheduledFor.getTime())) return "CONTENT_SCHEDULE_IN_PAST";

  // A browser clock a minute behind the server is ordinary, and one cron tick
  // is a minute wide - so "just now" is accepted and fires on the next tick.
  if (
    scheduledFor.getTime() <
    now.getTime() - CONTENT_SCHEDULE_PAST_TOLERANCE_MS
  ) {
    return "CONTENT_SCHEDULE_IN_PAST";
  }

  if (action === "unpublish") {
    const publish = pending.find(entry => entry.action === "publish");

    // Unpublishing before the publish that has not happened yet would fire
    // against a draft, no-op, and then the record would go live afterwards -
    // the opposite of what was asked for.
    if (
      publish &&
      new Date(publish.scheduledFor).getTime() >= scheduledFor.getTime()
    ) {
      return "CONTENT_SCHEDULE_ORDER";
    }
  }

  return null;
};
