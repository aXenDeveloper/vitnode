import React from "react";

import type { HoverCardHandle } from "./ui/hover-card";

export interface UserPreviewPayload {
  nameCode: string;
}

export const UserPreviewHandleContext =
  React.createContext<HoverCardHandle<UserPreviewPayload> | null>(null);
