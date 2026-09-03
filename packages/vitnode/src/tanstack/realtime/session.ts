import type { VitNodeSocketUserId } from "@/ws/auth-sync";

export interface SocketSession {
  user?: null | { id: number };
}

export const socketUserIdFromSession = (
  session: SocketSession | undefined,
): undefined | VitNodeSocketUserId => {
  if (!session) return undefined;

  return session.user?.id ?? null;
};
