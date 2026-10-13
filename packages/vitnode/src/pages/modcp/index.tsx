import { redirect } from "@tanstack/react-router";

import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const ModcpIndex = () => null;

export const route = defineAuthenticatedRoute({
  load: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ to: "/modcp/reports" });
  },

  breadcrumb: null,
});

export default ModcpIndex;
