import { useAppNavigate } from "../tanstack/auth/navigation";
import { loadRegisterRoute } from "../tanstack/auth/register-route";
import { RegisterRouteContent } from "../tanstack/auth/register-screen";
import { defineRoute } from "../tanstack/plugin-routes";

const RegisterPage = () => <RegisterRouteContent navigate={useAppNavigate()} />;

export const route = defineRoute<undefined>({
  load: async ({ context }) => {
    await loadRegisterRoute(context);
  },
  head: ({ t }) => ({ title: t("core.global.register") }),
});

export default RegisterPage;
