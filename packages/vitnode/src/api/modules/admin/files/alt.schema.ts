import { z } from "zod";

export const zodAltPolicy = z.enum(["automatic", "manual", "disabled"]);
