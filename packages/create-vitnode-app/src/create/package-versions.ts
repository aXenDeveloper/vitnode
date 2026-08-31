export const versionsPackageJson = {
  typesNode: "^26",
  typesReact: "^19.2",
  typesReactDom: "^19.2",
  typesBun: "latest",

  turbo: "^2.10",
  typescript: "^6.0",
  tsx: "^4",
  tscAlias: "^1.9",
  eslint: "^10",
  prettier: "^3.9",
  prettierTailwind: "^0.8",
  tailwind: "^4.2",
  twAnimateCss: "^1.4.0",

  react: "^19.2",
  reactDom: "^19.2",
  useIntl: "^4.13.7",
  rhf: "^7",
  rhfResolvers: "^5.1.1",
  lucide: "^1.21",
  sonner: "^2.0.7",
  dotenv: "^17.4",

  drizzleKit: "1.0.0-rc.4",
  drizzleOrm: "1.0.0-rc.4",

  hono: "^4.12",
  honoZodOpenapi: "^1.5",
  honoZodValidator: "^0.9",
  reactEmail: "^6.9",
  reactEmailUi: "^6.9",
  zod: "^4.4",

  ws: "^8",

  cva: "^0.7.1",

  // The TanStack Start stack a generated web app is built on. Pinned to the
  // same ranges `apps/web` runs, because that app is what the template mirrors
  // and a version skew between the two shows up as a route generator writing a
  // different `routeTree.gen.ts` than the one core's plugin routes expect.
  tanstackReactRouter: "^1.170",
  tanstackReactStart: "^1.168",
  tanstackReactQuery: "^5.101",
  tanstackRouterSsrQuery: "^1.167",
  tanstackReactDevtools: "^0.10",
  tanstackDevtoolsVite: "^0.8",
  tanstackQueryDevtools: "^5.102",
  tanstackRouterDevtools: "^1.167",
  vite: "^8.0",
  viteReact: "^6.0",
  tailwindVite: "^4.2",
  nitro: "3.0.260610-beta",

  /**
   * Externalised in the app's `vite.config.ts` rather than bundled, so it has to
   * be a real dependency of the app.
   *
   * Nitro re-resolves externals itself and traces this one into the output. See
   * the `ssr.external` note in the generated `vite.config.ts` for why bundling
   * it breaks every page that renders a dialog.
   */
  tslib: "^2.8.1",

  swcCli: "^0.8.1",
  swcCore: "^1.15",
  shadcn: "^4",
};
