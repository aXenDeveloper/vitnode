export const DOCS_STYLESHEET_PRECEDENCE = 'docs'

export const STYLESHEET_ORDER_ANCHOR = 'vitnode-stylesheet-order'

export const isDocsRouteId = (routeId: string): boolean =>
  routeId.startsWith('/_docs')
