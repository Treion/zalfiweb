"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/** Browser side of admin auth: sign in, sign out, two-factor */
export const authClient = createAuthClient({
  basePath: "/api/admin/auth",
  // The login form handles the two-factor step itself (it reads `twoFactorRedirect`)
  plugins: [twoFactorClient()],
});
