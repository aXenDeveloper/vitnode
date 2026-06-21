import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const normalizeUrl = (url: string) =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;
