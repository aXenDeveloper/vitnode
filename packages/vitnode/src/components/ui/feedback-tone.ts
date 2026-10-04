export const FEEDBACK_TONE_TEXT = {
  info: "text-[color-mix(in_oklab,var(--primary),var(--foreground)_20%)]",
  success: "text-[color-mix(in_oklab,var(--success),var(--foreground)_20%)]",
  warning: "text-[color-mix(in_oklab,var(--warn),var(--foreground)_20%)]",
  destructive:
    "text-[color-mix(in_oklab,var(--destructive),var(--foreground)_20%)]",
} as const;

export const SOLID_PRIMARY_SURFACE =
  "bg-primary text-primary-foreground dark:bg-[color-mix(in_oklab,var(--primary),var(--background)_15%)]";
