import { z } from "zod";

/**
 * A date on an event's JSON wire: emit an ISO string (`date.toISOString()`);
 * listeners and adapters receive a `Date`.
 */
export const eventDate = () =>
  z.iso.datetime().transform(value => new Date(value));
