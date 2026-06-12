// Edge-runtime-safe constants — no Node.js crypto imports.
// Middleware and Edge functions import from here; API routes use session.ts.

export const SESSION_COOKIE_NAME = "groe_session";
export const MAGIC_PENDING_COOKIE_NAME = "groe_magic_pending";
export const SSO_STATE_COOKIE_NAME = "groe_sso_state";

const IS_PROD = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const MAGIC_PENDING_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 15,
};

export const SSO_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 5,
};

export type UserRole =
  | "ic"
  | "leader"
  | "org_admin"
  | "groe_admin"
  | "groe_viewer";

export const ROLE_REDIRECT: Record<UserRole, string> = {
  ic: "/dashboard",
  leader: "/dashboard",
  org_admin: "/admin",
  groe_admin: "/groe-admin",
  groe_viewer: "/groe-admin",
};
