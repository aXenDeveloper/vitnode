export type { LegalAcceptRouteData, LegalAcceptSearch } from "./accept-route";
export {
  legalAcceptDestination,
  loadLegalAcceptRoute,
  normalizeLegalAcceptSearch,
} from "./accept-route";
export { LegalAcceptRouteContent } from "./accept-screen";
export { LegalFooterLinks } from "./footer-links";
export {
  isTermsGateOpenPath,
  LEGAL_ACCEPT_PATH,
  LegalStateSync,
  redirectPendingTerms,
  TERMS_GATE_OPEN_PATHS,
  TermsAcceptanceGate,
} from "./gate";
export { LegalNotices } from "./notices";
export { legalChangesPage, legalDocumentPage, legalVersionPage } from "./pages";
export type {
  LegalChangesSearch,
  LegalDocumentRouteData,
  LegalVersionRouteData,
} from "./route";
export {
  LEGAL_NAMESPACES,
  loadLegalChangesRoute,
  loadLegalDocumentRoute,
  loadLegalVersionRoute,
  normalizeLegalChangesSearch,
} from "./route";
export {
  LegalChangesRouteContent,
  LegalDocumentRouteContent,
  LegalVersionRouteContent,
} from "./screen";
