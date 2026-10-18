import React from "react";

import { LogoVitNodeBrand } from "./logo-vitnode";

/** A component that renders the site logo, the frontend config's `logo`. Takes no props. */
export type VitNodeLogo = React.ComponentType;

export const LogoContext = React.createContext<React.ReactNode>(
  <LogoVitNodeBrand />,
);

export const useLogo = (): React.ReactNode => React.use(LogoContext);
