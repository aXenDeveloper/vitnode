import { z } from "zod";

/** The public summary of a person named by `publicApi.people`. */
export interface ContentPublicPerson {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
  role: { color: null | string; prefix: null | string };
}

export const zodContentPublicPerson = z.object({
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
  id: z.number(),
  name: z.string(),
  nameCode: z.string(),
  role: z.object({
    color: z.string().nullable(),
    prefix: z.string().nullable(),
  }),
});

export const isContentPublicPerson = (
  value: unknown,
): value is ContentPublicPerson =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { id?: unknown }).id === "number" &&
  typeof (value as { nameCode?: unknown }).nameCode === "string";
