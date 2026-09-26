export type ZoneDropState =
  "idle" | "inserting" | "over" | "rejected" | "targeting";

export interface ZoneDropStateArgs {
  active: boolean;
  inserting: boolean;
  over: boolean;
  rejected: boolean;
}

export const zoneDropState = ({
  active,
  inserting,
  over,
  rejected,
}: ZoneDropStateArgs): ZoneDropState => {
  if (rejected) return "rejected";
  if (over) return "over";
  if (active) return "targeting";

  return inserting ? "inserting" : "idle";
};

export type ZoneDropTone = "blocked" | ZoneDropState;

export const zoneDropTone = (
  state: ZoneDropState,
  over: boolean,
): ZoneDropTone => (state === "rejected" && !over ? "blocked" : state);
