import { buildModule } from "@/api/builders";

import { userFilesModule } from "./files/files.module";
import { userImagesModule } from "./images/images.module";
import { passkeysUserModule } from "./passkeys/passkeys.module";
import { changePasswordRoute } from "./routes/change-password.route";
import { listDevicesRoute } from "./routes/devices.route";
import { mePolicyRoute } from "./routes/me-policy.route";
import { permissionsRoute } from "./routes/permissions.route";
import { presenceBatchRoute } from "./routes/presence-batch.route";
import { presenceHeartbeatRoute } from "./routes/presence-heartbeat.route";
import { presenceRoute } from "./routes/presence.route";
import { updateMyPrivacyRoute } from "./routes/privacy.route";
import { profileRoute } from "./routes/profile.route";
import { resendVerificationRoute } from "./routes/resend-verification.route";
import { resetPasswordRoute } from "./routes/reset-passowrd.route";
import { revokeDeviceRoute } from "./routes/revoke-device.route";
import { sessionRoute } from "./routes/session.route";
import { signInRoute } from "./routes/sign-in.route";
import { signOutRoute } from "./routes/sign-out.route";
import { signUpRoute } from "./routes/sign-up.route";
import { updateMyTimeZoneRoute } from "./routes/time-zone.route";
import { updateMeRoute } from "./routes/update-me.route";
import { verifyEmailRoute } from "./routes/verify-email.route";
import { ssoUserModule } from "./sso/sso.module";

export const usersModule = buildModule({
  name: "users",
  routes: [
    sessionRoute,
    signInRoute,
    signOutRoute,
    signUpRoute,
    resetPasswordRoute,
    verifyEmailRoute,
    resendVerificationRoute,
    changePasswordRoute,
    permissionsRoute,
    listDevicesRoute,
    revokeDeviceRoute,
    profileRoute,
    mePolicyRoute,
    updateMeRoute,
    updateMyTimeZoneRoute,
    updateMyPrivacyRoute,
    presenceHeartbeatRoute,
    presenceBatchRoute,
    presenceRoute,
  ],
  modules: [
    ssoUserModule,
    passkeysUserModule,
    userFilesModule,
    userImagesModule,
  ],
});
