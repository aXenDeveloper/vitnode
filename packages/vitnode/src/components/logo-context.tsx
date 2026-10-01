import React from "react";

import { LogoVitNodeBrand } from "./logo-vitnode";

export type VitNodeLogo = React.ComponentType;

export const LogoContext = React.createContext<React.ReactNode>(
  <LogoVitNodeBrand />,
);

export const useLogo = (): React.ReactNode => React.use(LogoContext);
