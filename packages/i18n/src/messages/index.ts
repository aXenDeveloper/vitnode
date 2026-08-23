import type { Locale } from "../core/shared";
import type { Messages } from "./en";

export type { Messages } from "./en";

/**
 * Loads one locale's messages.
 *
 * The imports are dynamic so each locale becomes its own chunk - an English
 * visitor never downloads the Polish strings.
 */
export const loadMessages = async (locale: Locale): Promise<Messages> => {
  switch (locale) {
    case "en":
      return (await import("./en")).en;
    case "pl":
      return (await import("./pl")).pl;
  }
};
