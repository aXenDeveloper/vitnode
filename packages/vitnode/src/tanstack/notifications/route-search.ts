export interface NotificationsRouteSearch {
  category?: string;
  filter?: "unread";
}

const CATEGORY = /^[a-z0-9_-]{1,50}$/;

export const normalizeNotificationsRouteSearch = (
  input: Record<string, unknown>,
): NotificationsRouteSearch => ({
  ...(typeof input.category === "string" && CATEGORY.test(input.category)
    ? { category: input.category }
    : {}),
  ...(input.filter === "unread" ? { filter: "unread" as const } : {}),
});
