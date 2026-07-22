// config/authConfig.ts
export const roleConfig = {
  user: {
    allowedRoles:    ["user", "admin"],
    verifyUrlPath:   "verify-mail",
    loginDeniedMsg:  "Only users can log in from this route.",
  },
  guide: {
    allowedRoles:    ["guide"],
    verifyUrlPath:   "guides/guide-verify-mail",
    loginDeniedMsg:  "Only Guides can log in from this route.",
  },
};