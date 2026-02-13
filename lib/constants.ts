/** @deprecated Old seed demo org – being removed. Use PUBLIC_DEMO_ORGANIZATION_ID. */
export const DEMO_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000000";

/** Organization shown to new users (read-only). This is your real org – new users see its blocks/content. */
export const PUBLIC_DEMO_ORGANIZATION_ID = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID ?? "1305bb82-5c49-4e27-bccd-9c942fa7fb06";

/** App admin emails – never shown demo restriction (always full access). */
export const APP_ADMIN_EMAILS = [
  "maildpwd@gmail.com",
  "mailidpwd@gmail.com", // typo variant
  ...(process.env.NEXT_PUBLIC_APP_ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? []),
];

export function isDemoOrganizationId(orgId: string | null | undefined): boolean {
  return orgId === DEMO_ORGANIZATION_ID;
}

/** True when this org is the one shown to new users (read-only). */
export function isPublicDemoOrganizationId(orgId: string | null | undefined): boolean {
  return orgId === PUBLIC_DEMO_ORGANIZATION_ID;
}
