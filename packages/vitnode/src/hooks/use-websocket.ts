import React from "react";

export const WebsocketContext = React.createContext<{
  isConnected: boolean;
}>({
  isConnected: false,
});
